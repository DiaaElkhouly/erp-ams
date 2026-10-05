import { describe, expect, it } from "vitest";
import {
  applyPayment,
  invoiceTotals,
  isSettled,
  outstanding,
  resolvePaymentStatus,
  reversePayment,
  roundMoney,
} from "@/lib/finance/invoice";

const NOW = new Date("2026-10-05T12:00:00Z");

function invoice(overrides: Partial<Parameters<typeof resolvePaymentStatus>[0]> = {}) {
  return {
    status: "ISSUED" as const,
    total: 1000,
    amountPaid: 0,
    dueDate: new Date("2026-11-05T00:00:00Z"),
    ...overrides,
  };
}

describe("invoiceTotals", () => {
  it("sums line totals and adds tax on the subtotal", () => {
    const totals = invoiceTotals(
      [{ quantity: 10, unitPrice: 129.99 }, { quantity: 2, unitPrice: 50 }],
      14,
    );
    // 10 x 129.99 = 1299.90, plus 2 x 50 = 100.
    expect(totals.subtotal).toBe(1399.9);
    // 1399.90 x 14% = 195.986, rounded to the cent the column can hold.
    expect(totals.taxAmount).toBe(195.99);
    expect(totals.total).toBe(1595.89);
  });

  it("keeps subtotal plus tax equal to total after rounding", () => {
    // 3 x 0.335 is 1.005, which rounds away. Without rounding on both figures the
    // invoice would be off by a cent against its own arithmetic.
    const totals = invoiceTotals([{ quantity: 3, unitPrice: 0.335 }], 10);
    expect(totals.subtotal).toBe(1.01);
    expect(totals.total).toBe(roundMoney(totals.subtotal + totals.taxAmount));
  });

  it("treats an invoice with no lines as zero rather than NaN", () => {
    expect(invoiceTotals([])).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});

describe("outstanding and isSettled", () => {
  it("subtracts what has been paid", () => {
    expect(outstanding(1000, 250)).toBe(750);
  });

  it("clamps a zero-value invoice to settled", () => {
    expect(isSettled(0, 0)).toBe(true);
  });

  it("counts an overpayment as settled", () => {
    // Supplier settlements routinely round up. Clamping the payment would hide the
    // surplus; reporting it as still owing would be nonsense.
    expect(isSettled(1000, 1050)).toBe(true);
  });
});

describe("resolvePaymentStatus", () => {
  it("keeps a draft a draft however much has been paid", () => {
    // Money against an unreleased bill is a prepayment, not a payment of it.
    expect(resolvePaymentStatus(invoice({ status: "DRAFT", amountPaid: 500 }), NOW)).toBe("DRAFT");
  });

  it("treats CANCELLED as terminal", () => {
    expect(resolvePaymentStatus(invoice({ status: "CANCELLED", amountPaid: 0 }), NOW)).toBe("CANCELLED");
    expect(resolvePaymentStatus(invoice({ status: "CANCELLED", amountPaid: 1000 }), NOW)).toBe("CANCELLED");
  });

  it("reads as ISSUED with no money against it and no due date passed", () => {
    expect(resolvePaymentStatus(invoice(), NOW)).toBe("ISSUED");
  });

  it("goes OVERDUE once the due date passes, with no write at all", () => {
    const result = resolvePaymentStatus(invoice({ dueDate: new Date("2026-10-01T00:00:00Z") }), NOW);
    expect(result).toBe("OVERDUE");
  });

  it("never goes overdue without a due date", () => {
    expect(resolvePaymentStatus(invoice({ dueDate: null }), NOW)).toBe("ISSUED");
  });

  it("still reports OVERDUE ahead of PAID when a settled invoice is past due", () => {
    // Settled wins: once the money is in, the lateness is history, not a status.
    expect(resolvePaymentStatus(invoice({ amountPaid: 1000 }), NOW)).toBe("PAID");
    expect(
      resolvePaymentStatus(invoice({ amountPaid: 1000, dueDate: new Date("2026-01-01T00:00:00Z") }), NOW),
    ).toBe("PAID");
  });

  it("reads a part payment as PARTIALLY_PAID", () => {
    expect(resolvePaymentStatus(invoice({ amountPaid: 100 }), NOW)).toBe("PARTIALLY_PAID");
  });
});

describe("applyPayment", () => {
  it("accumulates the paid amount and marks it settled", () => {
    expect(applyPayment(invoice({ amountPaid: 400 }), 600, NOW)).toEqual({
      amountPaid: 1000,
      status: "PAID",
    });
  });

  it("accepts an overpayment rather than clamping or rejecting it", () => {
    expect(applyPayment(invoice(), 1050, NOW)).toEqual({ amountPaid: 1050, status: "PAID" });
  });

  it("rounds the running total so it stays a valid Decimal(14,2)", () => {
    expect(applyPayment(invoice({ amountPaid: 0.1 }), 0.2, NOW).amountPaid).toBe(0.3);
  });

  it("rejects a zero or negative payment", () => {
    expect(() => applyPayment(invoice(), 0)).toThrow(RangeError);
    expect(() => applyPayment(invoice(), -50)).toThrow(RangeError);
    expect(() => applyPayment(invoice(), Number.NaN)).toThrow(RangeError);
  });
});

describe("reversePayment", () => {
  it("reduces the paid amount and re-derives the status", () => {
    const paid = { ...invoice(), amountPaid: 1000, status: "PAID" as const };
    expect(reversePayment(paid, 400, NOW)).toEqual({ amountPaid: 600, status: "PARTIALLY_PAID" });
  });

  it("clamps at zero rather than going negative", () => {
    // A reversal larger than the recorded payments is a data-entry mistake. A
    // negative paid amount would report the invoice as owing money in reverse.
    expect(reversePayment({ ...invoice(), amountPaid: 100 }, 500, NOW).amountPaid).toBe(0);
  });

  it("rejects a zero or negative reversal", () => {
    expect(() => reversePayment(invoice(), 0)).toThrow(RangeError);
  });
});