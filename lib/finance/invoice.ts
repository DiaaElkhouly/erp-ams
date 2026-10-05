/**
 * Invoice arithmetic and the payment-status state machine, with no database.
 *
 * Both invoice directions share this module on purpose. A payable and a
 * receivable differ only in whose name is on the document, and two copies of the
 * status rules would drift apart the first time somebody fixed a bug in one of
 * them.
 *
 * Money arrives as a Prisma Decimal or a string depending on the caller, so every
 * entry point normalises to a number and rounds back to 2dp. Rounding once here is
 * what keeps `subtotal + tax === total` instead of being approximately true.
 */

export type InvoiceLineDraft = {
  quantity: number;
  unitPrice: number;
};

export type InvoiceTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

/** Money is stored as Decimal(14,2), so half-cents are not representable. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sums line totals and adds tax. An empty invoice is zero, not NaN. */
export function invoiceTotals(lines: InvoiceLineDraft[], taxRatePercent = 0): InvoiceTotals {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const taxAmount = roundMoney((subtotal * taxRatePercent) / 100);
  return { subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
}

/** Prisma Decimal.js, or a string from JSON. Both normalise to a number. */
export type MoneyLike = number | string | { toNumber(): number };

function money(value: MoneyLike): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export type PaymentStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type InvoiceState = {
  status: PaymentStatus;
  total: MoneyLike;
  amountPaid: MoneyLike;
  /** Null means no agreed due date, so the invoice can never go overdue. */
  dueDate: Date | string | null;
};

export function outstanding(total: MoneyLike, amountPaid: MoneyLike): number {
  return roundMoney(money(total) - money(amountPaid));
}

export function isSettled(total: MoneyLike, amountPaid: MoneyLike): boolean {
  return roundMoney(money(amountPaid)) >= roundMoney(money(total));
}

/**
 * The status an invoice should hold given how much has been paid against it.
 *
 * Two rules are load-bearing:
 *
 *  - A DRAFT invoice stays DRAFT whatever the payments say. Money arriving before
 *    the document is issued is a prepayment, and flipping the status would tell
 *    the counterparty they owe nothing on a bill they have not received.
 *  - CANCELLED is terminal. Nothing reopens a cancelled invoice.
 *
 * Overdue is derived from the due date rather than stored, because it becomes true
 * with no write at all - at midnight, on a document nobody touched.
 */
export function resolvePaymentStatus(invoice: InvoiceState, now = new Date()): PaymentStatus {
  if (invoice.status === "CANCELLED") return "CANCELLED";
  if (invoice.status === "DRAFT") return "DRAFT";
  if (isSettled(invoice.total, invoice.amountPaid)) return "PAID";

  const due = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (due && due.getTime() < now.getTime()) return "OVERDUE";

  return money(invoice.amountPaid) > 0 ? "PARTIALLY_PAID" : "ISSUED";
}

export type AppliedPayment = {
  amountPaid: number;
  status: PaymentStatus;
};

/**
 * Records a payment against an invoice.
 *
 * A payment larger than the outstanding balance is accepted rather than rejected
 * and clamped: overpayment is a real thing in supplier settlement, and silently
 * discarding the excess hides a bank error. The invoice simply reads as PAID and
 * the surplus is visible in the payments list against it.
 */
export function applyPayment(invoice: InvoiceState, amount: number, now = new Date()): AppliedPayment {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(`Payment amount must be a positive number, received ${amount}`);
  }

  const amountPaid = roundMoney(money(invoice.amountPaid) + amount);
  return {
    amountPaid,
    status: resolvePaymentStatus({ ...invoice, amountPaid }, now),
  };
}

/** Releases a payment, e.g. a bank transfer was reversed. */
export function reversePayment(invoice: InvoiceState, amount: number, now = new Date()): AppliedPayment {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(`Reversal amount must be a positive number, received ${amount}`);
  }

  // Clamped at zero rather than allowed to go negative: a reversal larger than the
  // recorded payments is a data-entry mistake, and a negative paid amount would
  // report the invoice as owing money in the wrong direction.
  const amountPaid = roundMoney(Math.max(0, money(invoice.amountPaid) - amount));
  return {
    amountPaid,
    status: resolvePaymentStatus({ ...invoice, amountPaid }, now),
  };
}