"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Receipt, Wallet, FileText, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TablePagination } from "@/components/shared/data-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/**
 * The six states an invoice can be in. The three payment-derived ones
 * (PARTIALLY_PAID, PAID, OVERDUE) are computed by the API and never set by hand,
 * so the table offers no button that would try to write one.
 */
const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  DRAFT: "secondary", ISSUED: "default", PARTIALLY_PAID: "default",
  PAID: "success", OVERDUE: "destructive", CANCELLED: "destructive",
};

type LineDraft = { itemId: string; description: string; quantity: number; price: number };

/**
 * One hook for both directions. Two separate hooks called from a ternary would
 * break the rules of hooks the moment a caller ever rendered both directions.
 */
function useInvoices(direction: "supplier" | "customer") {
  const isSupplier = direction === "supplier";
  return useQuery({
    queryKey: [isSupplier ? "supplier-invoices" : "customer-invoices"],
    queryFn: () => fetch(isSupplier ? "/api/supplier-invoices" : "/api/customer-invoices").then((r) => r.json()),
  });
}

function usePayments() {
  return useQuery({ queryKey: ["payments"], queryFn: () => fetch("/api/payments").then((r) => r.json()) });
}
function useSuppliers() {
  return useQuery({ queryKey: ["suppliers"], queryFn: () => fetch("/api/suppliers").then((r) => r.json()) });
}
function useCustomers() {
  return useQuery({ queryKey: ["customers"], queryFn: () => fetch("/api/customers").then((r) => r.json()) });
}
function useItemsList() {
  return useQuery({ queryKey: ["items", ""], queryFn: () => fetch("/api/items?pageSize=200").then((r) => r.json()) });
}

function blankLine(): LineDraft {
  return { itemId: "", description: "", quantity: 1, price: 0 };
}

/**
 * One dialog builds both invoice directions; `direction` decides the endpoint,
 * the party field name, and whether the money column is a cost or a price.
 */
function NewInvoiceDialog({ direction }: { direction: "supplier" | "customer" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState(0);
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const qc = useQueryClient();

  const { data: supplierData } = useSuppliers();
  const { data: customerData } = useCustomers();
  const { data: itemsData } = useItemsList();
  const parties = direction === "supplier" ? supplierData?.suppliers : customerData?.customers;

  const isSupplier = direction === "supplier";
  const endpoint = isSupplier ? "/api/supplier-invoices" : "/api/customer-invoices";
  const queryKey = isSupplier ? "supplier-invoices" : "customer-invoices";

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isSupplier ? { supplierId: partyId } : { customerId: partyId }),
          dueDate: dueDate || undefined,
          taxRatePercent,
          // Blank descriptions become the linked item's name server-side.
          lines: lines
            .filter((l) => l.itemId || l.description)
            .map((l) => ({
              itemId: l.itemId || undefined,
              description: l.description || t.finance.defaultLineDescription,
              quantity: Number(l.quantity),
              ...(isSupplier ? { unitCost: Number(l.price) } : { unitPrice: Number(l.price) }),
            })),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? t.finance.createFailed);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(t.finance.created(t.common.supplier));
      setOpen(false);
      setPartyId("");
      setDueDate("");
      setTaxRatePercent(0);
      setLines([blankLine()]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filled = lines.filter((l) => l.itemId || l.description);
  const subtotal = filled.reduce((sum, l) => sum + Number(l.quantity) * Number(l.price), 0);
  const tax = subtotal * (Number(taxRatePercent) / 100);
  const canSave = Boolean(partyId) && filled.length > 0 && filled.every((l) => Number(l.quantity) > 0);

  /** Picking an item prefills its name and standard price so the row is not blank work. */
  function applyItem(index: number, itemId: string) {
    const item = itemsData?.items?.find((i: any) => i.id === itemId);
    setLines((current) =>
      current.map((line, i) =>
        i === index
          ? {
              ...line,
              itemId,
              description: item?.name ?? line.description,
              price: item ? Number(isSupplier ? item.costPrice : item.salePrice) : line.price,
            }
          : line,
      ),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> {t.finance.newInvoice(isSupplier ? t.common.supplier : t.common.customer)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isSupplier ? t.finance.newSupplierInvoice : t.finance.newCustomerInvoice}</DialogTitle>
          <DialogDescription>
            {t.finance.saveDraftHint}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[55vh] space-y-5 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="invoice-party">{isSupplier ? t.common.supplier : t.common.customer}</Label>
              <NativeSelect id="invoice-party" className="w-full" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">{t.finance.selectAny}</option>
                {parties?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due">{t.production.dueDate}</Label>
              <Input id="invoice-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-tax">{t.finance.taxRate}</Label>
              <Input
                id="invoice-tax"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.finance.lines}</Label>
              <Button variant="outline" size="sm" onClick={() => setLines([...lines, blankLine()])}>
                <Plus className="h-3.5 w-3.5" /> {t.finance.addLine}
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Label className="sr-only">{t.common.item}</Label>
                    <NativeSelect
                      className="w-full"
                      value={line.itemId}
                      onChange={(e) => applyItem(index, e.target.value)}
                    >
                      <option value="">{t.finance.lineWithoutItem}</option>
                      {itemsData?.items?.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="sr-only">{t.common.description}</Label>
                    <Input
                      placeholder={t.common.description}
                      value={line.description}
                      onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, description: e.target.value } : l)))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="sr-only">{t.common.quantity}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, quantity: Number(e.target.value) } : l)))}
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={isSupplier ? t.common.cost : t.common.salePrice}
                      value={line.price}
                      onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, price: Number(e.target.value) } : l)))}
                    />
                    {lines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex justify-between"><span>{t.finance.subtotal}</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span>{t.finance.tax}</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between font-medium"><span>{t.common.total}</span><span>{formatCurrency(subtotal + tax)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isPending || !canSave} onClick={() => mutate()}>
            {isPending ? t.common.saving : t.finance.saveDraft}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Records money against an invoice.
 *
 * The invoice is chosen from the ones still owing, so the amount defaults to the
 * outstanding balance: the common case is "pay this bill in full", and making
 * someone type the figure they can already see is a chance to type it wrong.
 */
function RecordPaymentDialog({ direction }: { direction: "supplier" | "customer" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const qc = useQueryClient();

  const { data: supplierData } = useInvoices("supplier");
  const { data: customerData } = useInvoices("customer");
  const isSupplier = direction === "supplier";
  const invoices = (isSupplier ? supplierData?.supplierInvoices : customerData?.customerInvoices) ?? [];
  const payable = invoices.filter((i: any) => i.status !== "DRAFT" && i.status !== "CANCELLED" && Number(i.amountPaid) < Number(i.total));

  const selected = invoices.find((i: any) => i.id === invoiceId);
  const outstanding = selected ? Math.max(0, Number(selected.total) - Number(selected.amountPaid)) : 0;

  /** Picking an invoice fills in what it still owes, so the common case needs no typing. */
  function applyInvoice(id: string) {
    setInvoiceId(id);
    const picked = invoices.find((i: any) => i.id === id);
    setAmount(picked ? Math.max(0, Number(picked.total) - Number(picked.amountPaid)).toFixed(2) : "");
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party: isSupplier ? "SUPPLIER" : "CUSTOMER",
          ...(isSupplier ? { supplierInvoiceId: invoiceId } : { customerInvoiceId: invoiceId }),
          amount: Number(amount),
          method,
          reference: reference || undefined,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? t.finance.paymentFailed);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      qc.invalidateQueries({ queryKey: ["customer-invoices"] });
      toast.success(t.finance.paymentRecorded);
      setOpen(false);
      setInvoiceId("");
      setAmount("");
      setReference("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="h-4 w-4" /> {t.finance.recordPayment}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.finance.recordPayment}</DialogTitle>
          <DialogDescription>{t.finance.recordPaymentHint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="payment-invoice">{t.finance.invoice}</Label>
            <NativeSelect id="payment-invoice" className="w-full" value={invoiceId} onChange={(e) => applyInvoice(e.target.value)}>
              <option value="">{t.finance.selectInvoice}</option>
              {payable.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {t.finance.outstandingOf(formatCurrency(Number(i.total) - Number(i.amountPaid)))}
                </option>
              ))}
            </NativeSelect>
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {t.finance.balanceLine(
                formatCurrency(selected.total),
                formatCurrency(selected.amountPaid),
                formatCurrency(outstanding),
              )}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">{t.finance.amount}</Label>
              <Input id="payment-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">{t.finance.method}</Label>
              <NativeSelect id="payment-method" className="w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="BANK_TRANSFER">{t.finance.methodLabels.BANK_TRANSFER}</option>
                <option value="CASH">{t.finance.methodLabels.CASH}</option>
                <option value="CARD">{t.finance.methodLabels.CARD}</option>
                <option value="CHEQUE">{t.finance.methodLabels.CHEQUE}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-ref">{t.finance.reference}</Label>
            <Input id="payment-ref" placeholder={t.finance.referencePlaceholder} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending || !invoiceId || !(Number(amount) > 0)} onClick={() => mutate()}>
            {isPending ? t.common.saving : t.finance.recordPayment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Issues a draft invoice, or cancels a live one. Both are one-way transitions. */
function useInvoiceAction(isSupplier: boolean) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const endpoint = isSupplier ? "supplier-invoices" : "customer-invoices";
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? t.finance.statusUpdateFailed);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [endpoint] });
      toast.success(t.finance.statusUpdated);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Hard delete, only for invoices nothing has been paid against. */
function useInvoiceDelete(isSupplier: boolean) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const endpoint = isSupplier ? "supplier-invoices" : "customer-invoices";
  const { mutate, isPending } = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/${endpoint}/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? t.finance.deleteFailed);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [endpoint] });
      toast.success(t.finance.deleted);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { mutate, isPending };
}

function InvoicesTab({ direction }: { direction: "supplier" | "customer" }) {
  const { t } = useI18n();
  const isSupplier = direction === "supplier";
  const { data, isLoading } = useInvoices(direction);
  const act = useInvoiceAction(isSupplier);
  const del = useInvoiceDelete(isSupplier);

  const rows = (isSupplier ? data?.supplierInvoices : data?.customerInvoices) ?? [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const partyOf = (invoice: any) => (isSupplier ? invoice.supplier?.name : invoice.customer?.name);

  const totals = rows.reduce(
    (acc: { billed: number; outstanding: number; overdue: number }, i: any) => {
      const outstanding = Math.max(0, Number(i.total) - Number(i.amountPaid));
      if (i.status !== "CANCELLED" && i.status !== "DRAFT") acc.billed += Number(i.total);
      if (i.status !== "CANCELLED" && i.status !== "DRAFT" && i.status !== "PAID") acc.outstanding += outstanding;
      if (i.status === "OVERDUE") acc.overdue += outstanding;
      return acc;
    },
    { billed: 0, outstanding: 0, overdue: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>{t.finance.billed}: <span className="font-medium">{formatCurrency(totals.billed)}</span></span>
          <span>{t.finance.outstanding}: <span className="font-medium">{formatCurrency(totals.outstanding)}</span></span>
          <span>
            {t.finance.overdue}:{" "}
            <span className={totals.overdue > 0 ? "font-medium text-destructive" : "font-medium"}>
              {formatCurrency(totals.overdue)}
            </span>
          </span>
        </div>
        <NewInvoiceDialog direction={direction} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.finance.number}</TableHead>
              <TableHead>{isSupplier ? t.common.supplier : t.common.customer}</TableHead>
              <TableHead>{t.finance.due}</TableHead>
              <TableHead>{t.common.total}</TableHead>
              <TableHead>{t.finance.amountPaid}</TableHead>
              <TableHead>{t.finance.outstanding}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-6 w-6" /> {t.finance.empty}
                </TableCell>
              </TableRow>
            )}
            {rows.slice((page - 1) * pageSize, page * pageSize).map((invoice: any) => {
              const outstanding = Math.max(0, Number(invoice.total) - Number(invoice.amountPaid));
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{partyOf(invoice)}</TableCell>
                  <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</TableCell>
                  <TableCell>{formatCurrency(invoice.total)}</TableCell>
                  <TableCell>{formatCurrency(invoice.amountPaid)}</TableCell>
                  <TableCell>{formatCurrency(outstanding)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[invoice.status]}>{t.finance.status[invoice.status as keyof typeof t.finance.status] ?? invoice.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {invoice.status === "DRAFT" && (
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: invoice.id, status: "ISSUED" })}>
                        {t.finance.issue}
                      </Button>
                    )}
                    {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ id: invoice.id, status: "CANCELLED" })}>
                        {t.finance.cancel}
                      </Button>
                    )}
                    {/* Deleting cascades to the payment ledger, so the API refuses
                        an invoice that has money against it - only offer it otherwise. */}
                    {invoice.payments?.length === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={del.isPending}
                        title={t.common.delete}
                        onClick={() => del.mutate(invoice.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageCount={Math.max(1, Math.ceil(rows.length / pageSize))}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

function PaymentsTab() {
  const { t } = useI18n();
  const { data, isLoading } = usePayments();
  const qc = useQueryClient();
  const payments = data?.payments ?? [];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { mutate: reverse, isPending: reversing } = useMutation({
    mutationFn: (id: string) => fetch(`/api/payments?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      // A reversal moves money back onto the invoice, so every invoice list and the
      // outstanding totals derived from them are now stale.
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      qc.invalidateQueries({ queryKey: ["customer-invoices"] });
      toast.success(t.finance.reversed);
    },
    onError: () => toast.error(t.finance.reverseFailed),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <RecordPaymentDialog direction="supplier" />
        <RecordPaymentDialog direction="customer" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.date}</TableHead>
              <TableHead>{t.finance.party}</TableHead>
              <TableHead>{t.finance.invoice}</TableHead>
              <TableHead>{t.finance.amount}</TableHead>
              <TableHead>{t.finance.method}</TableHead>
              <TableHead>{t.finance.reference}</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <ArrowLeftRight className="mx-auto mb-2 h-6 w-6" /> {t.finance.noPayments}
                </TableCell>
              </TableRow>
            )}
            {payments.slice((page - 1) * pageSize, page * pageSize).map((payment: any) => {
              const invoice = payment.supplierInvoice ?? payment.customerInvoice;
              return (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paidAt)}</TableCell>
                  <TableCell>
                    <Badge variant={payment.party === "SUPPLIER" ? "secondary" : "default"}>
                      {payment.party === "SUPPLIER" ? t.finance.partyBadge.supplier : t.finance.partyBadge.customer}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {invoice?.invoiceNumber}
                    <span className="block text-muted-foreground">{invoice?.supplier?.name ?? invoice?.customer?.name}</span>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{t.finance.methodLabels[payment.method as keyof typeof t.finance.methodLabels] ?? payment.method}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{payment.reference ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={reversing}
                      title={t.common.delete}
                      onClick={() => reverse(payment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageCount={Math.max(1, Math.ceil(payments.length / pageSize))}
        pageSize={pageSize}
        total={payments.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

export default function FinancePage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t.nav.finance}</h1>
        <p className="text-sm text-muted-foreground">{t.finance.description}</p>
      </div>

      <Tabs defaultValue="supplier-invoices">
        <TabsList>
          <TabsTrigger value="supplier-invoices">{t.finance.supplierInvoices}</TabsTrigger>
          <TabsTrigger value="customer-invoices">{t.finance.customerInvoices}</TabsTrigger>
          <TabsTrigger value="payments">{t.finance.payments}</TabsTrigger>
        </TabsList>
        <TabsContent value="supplier-invoices"><InvoicesTab direction="supplier" /></TabsContent>
        <TabsContent value="customer-invoices"><InvoicesTab direction="customer" /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}