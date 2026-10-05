"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateParty, useDeleteParty, usePartiesList, useUpdateParty } from "../hooks/use-parties";
import type { Party, PartyKind } from "../services/party-service";
import { useI18n } from "@/lib/i18n";

const EMPTY = { name: "", email: "", phone: "", address: "" };

function PartyFormDialog({
  kind,
  party,
  open,
  onOpenChange,
}: {
  kind: PartyKind;
  /** null = create. Non-null = edit that row. */
  party: Party | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);
  const create = useCreateParty(kind);
  const update = useUpdateParty(kind);

  // Re-seed whenever the dialog opens: react-hook-form-free local state would
  // otherwise keep the previously edited row's values.
  useEffect(() => {
    if (!open) return;
    setForm(party ? { name: party.name, email: party.email ?? "", phone: party.phone ?? "", address: party.address ?? "" } : EMPTY);
  }, [open, party]);

  const isPending = create.isPending || update.isPending;
  const copy = kind === "customers"
    ? { title: party ? t.common.editCustomer : t.common.newCustomer, submit: t.common.saveCustomer }
    : { title: party ? t.common.editSupplier : t.common.newSupplier, submit: t.common.saveSupplier };

  function submit() {
    const payload = {
      name: form.name.trim(),
      // Empty means "not set", not "set to the empty string": the columns are
      // nullable and an empty email is not a valid one.
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    };
    const done = () => onOpenChange(false);
    if (party) update.mutate({ id: party.id, patch: payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{copy.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${kind}-name`}>{t.common.name}</Label>
            <Input id={`${kind}-name`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${kind}-email`}>{t.common.email}</Label>
            <Input id={`${kind}-email`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${kind}-phone`}>{t.common.phone}</Label>
            <Input id={`${kind}-phone`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${kind}-address`}>{t.common.address}</Label>
            <Input id={`${kind}-address`} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button disabled={isPending || !form.name.trim()} onClick={submit}>
            <Save className="h-4 w-4" />
            {isPending ? t.common.saving : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The customer or supplier register.
 *
 * Both modules are the same list with the same four columns and the same
 * create/edit/delete dialog, so this is rendered once and pointed at by
 * `kind`.
 */
export function PartyTable({ kind }: { kind: PartyKind }) {
  const { t } = useI18n();
  const { data, isLoading } = usePartiesList(kind);
  const { mutate: remove } = useDeleteParty(kind);
  const [editing, setEditing] = useState<Party | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = data?.[kind] ?? [];
  const isCustomer = kind === "customers";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {isCustomer ? t.common.newCustomer : t.common.newSupplier}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.common.email}</TableHead>
              <TableHead>{t.common.phone}</TableHead>
              <TableHead>{t.common.address}</TableHead>
              <TableHead className="w-20 text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
              </TableRow>
            ))}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {isCustomer ? t.common.noCustomers : t.common.noSuppliers}
                </TableCell>
              </TableRow>
            )}

            {rows.map((party) => (
              <TableRow key={party.id}>
                <TableCell className="font-medium">{party.name}</TableCell>
                <TableCell>{party.email || "—"}</TableCell>
                <TableCell>{party.phone || "—"}</TableCell>
                <TableCell>{party.address || "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(party)} aria-label={t.common.edit}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(party.id)} aria-label={t.common.delete}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PartyFormDialog kind={kind} party={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <PartyFormDialog kind={kind} party={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}