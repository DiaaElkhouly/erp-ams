"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  partyService,
  type PartyInput,
  type PartyKind,
  type PartyPatch,
} from "../services/party-service";

/**
 * One hook per operation, per party kind.
 *
 * Returned as a bundle instead (`{ list, create }`) because a hook-returning
 * factory has to be called inside a callback, which the rules of hooks reject —
 * and this one is shared by two pages, so the ordering has to be right in both.
 *
 * Cache keys are per kind rather than shared: invalidating customers after an edit
 * must not also refetch the supplier list on the purchasing page.
 */
function usePartyMessages(kind: PartyKind) {
  const { t } = useI18n();
  return kind === "customers"
    ? { created: t.toast.customerAdded, updated: t.toast.customerUpdated, deleted: t.toast.customerDeleted }
    : { created: t.toast.supplierAdded, updated: t.toast.supplierUpdated, deleted: t.toast.supplierDeleted };
}

export function usePartiesList(kind: PartyKind) {
  return useQuery({
    queryKey: [kind],
    queryFn: partyService(kind).list,
    placeholderData: (previous) => previous,
  });
}

export function useCreateParty(kind: PartyKind) {
  const messages = usePartyMessages(kind);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PartyInput) => partyService(kind).create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind] });
      toast.success(messages.created);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateParty(kind: PartyKind) {
  const messages = usePartyMessages(kind);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PartyPatch }) => partyService(kind).update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind] });
      toast.success(messages.updated);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteParty(kind: PartyKind) {
  const messages = usePartyMessages(kind);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => partyService(kind).remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind] });
      toast.success(messages.deleted);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}