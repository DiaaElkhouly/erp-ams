import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { applyPayment, reversePayment } from "@/lib/finance/invoice";

const schema = z
  .object({
    party: z.enum(["SUPPLIER", "CUSTOMER"]),
    /** Exactly one of these, matching `party`. Enforced below, not by zod. */
    supplierInvoiceId: z.string().min(1).optional(),
    customerInvoiceId: z.string().min(1).optional(),
    amount: z.coerce.number().positive(),
    method: z.string().min(1).default("BANK_TRANSFER"),
    reference: z.string().optional(),
    paidAt: z.coerce.date().optional(),
  })
  .refine(
    // Payment has two nullable invoice FKs because Payment is shared by both
    // directions. Postgres cannot require exactly one to be set, so the shape
    // rule lives here: naming both invoices would credit one and bill the other.
    (body) =>
      (body.party === "SUPPLIER") === (body.supplierInvoiceId !== undefined && body.customerInvoiceId === undefined) &&
      (body.party === "CUSTOMER") === (body.customerInvoiceId !== undefined && body.supplierInvoiceId === undefined),
    { message: "A payment must name exactly one invoice, and it must match the party" },
  );

export async function GET() {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  const payments = await db.payment.findMany({
    include: {
      supplierInvoice: { select: { invoiceNumber: true, supplier: { select: { name: true } } } },
      customerInvoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } },
    },
    orderBy: { paidAt: "desc" },
  });
  return NextResponse.json({ payments });
}

/**
 * Records money against one invoice and re-derives that invoice's payment status.
 *
 * Both halves in one `$transaction` because a payment row with a stale
 * `amountPaid` on the invoice is worse than no payment row at all - the balance
 * would disagree with the ledger of what was actually paid.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "PAYMENT", (data: any) => data?.id, async () => {
      const result = await db.$transaction(async (tx) => {
        if (body.party === "SUPPLIER") {
          const invoice = await tx.supplierInvoice.findUnique({ where: { id: body.supplierInvoiceId! } });
          if (!invoice) throw notFound("Supplier invoice not found");
          if (invoice.status === "DRAFT") {
            throw conflict(
              `Supplier invoice ${invoice.invoiceNumber} is still a draft. Issue it before recording a payment.`,
            );
          }

          const next = applyPayment(
            { status: invoice.status, total: Number(invoice.total), amountPaid: Number(invoice.amountPaid), dueDate: invoice.dueDate },
            body.amount,
          );

          const payment = await tx.payment.create({
            data: {
              party: "SUPPLIER",
              supplierInvoiceId: invoice.id,
              amount: body.amount,
              method: body.method,
              reference: body.reference,
              paidAt: body.paidAt,
            },
          });
          const updated = await tx.supplierInvoice.update({
            where: { id: invoice.id },
            data: { amountPaid: next.amountPaid, status: next.status },
          });
          return { payment, invoice: updated };
        }

        const invoice = await tx.customerInvoice.findUnique({ where: { id: body.customerInvoiceId! } });
        if (!invoice) throw notFound("Customer invoice not found");
        if (invoice.status === "DRAFT") {
          throw conflict(
            `Customer invoice ${invoice.invoiceNumber} is still a draft. Issue it before recording a payment.`,
          );
        }

        const next = applyPayment(
          { status: invoice.status, total: Number(invoice.total), amountPaid: Number(invoice.amountPaid), dueDate: invoice.dueDate },
          body.amount,
        );

        const payment = await tx.payment.create({
          data: {
            party: "CUSTOMER",
            customerInvoiceId: invoice.id,
            amount: body.amount,
            method: body.method,
            reference: body.reference,
            paidAt: body.paidAt,
          },
        });
        const updated = await tx.customerInvoice.update({
          where: { id: invoice.id },
          data: { amountPaid: next.amountPaid, status: next.status },
        });
        return { payment, invoice: updated };
      });

      return { data: result, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Unwinds a payment: a returned transfer or a wrong-direction receipt. */
export async function DELETE(req: NextRequest) {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw notFound("Payment not found");

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "DELETE", "PAYMENT", () => id, async () => {
      const result = await db.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id } });
        if (!payment) throw notFound("Payment not found");

        if (payment.supplierInvoiceId) {
          const invoice = await tx.supplierInvoice.findUnique({ where: { id: payment.supplierInvoiceId } });
          if (!invoice) throw notFound("Supplier invoice not found");
          const next = reversePayment(
            { status: invoice.status, total: Number(invoice.total), amountPaid: Number(invoice.amountPaid), dueDate: invoice.dueDate },
            Number(payment.amount),
          );
          await tx.supplierInvoice.update({
            where: { id: invoice.id },
            data: { amountPaid: next.amountPaid, status: next.status },
          });
        } else if (payment.customerInvoiceId) {
          const invoice = await tx.customerInvoice.findUnique({ where: { id: payment.customerInvoiceId } });
          if (!invoice) throw notFound("Customer invoice not found");
          const next = reversePayment(
            { status: invoice.status, total: Number(invoice.total), amountPaid: Number(invoice.amountPaid), dueDate: invoice.dueDate },
            Number(payment.amount),
          );
          await tx.customerInvoice.update({
            where: { id: invoice.id },
            data: { amountPaid: next.amountPaid, status: next.status },
          });
        }

        await tx.payment.delete({ where: { id } });
        return { success: true };
      });

      return { data: result };
    });
  } catch (err) {
    return handleApiError(err);
  }
}