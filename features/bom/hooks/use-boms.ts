"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { itemService } from "@/features/inventory/services/item-service";
import { bomService, type BomInput, type BomPatch } from "../services/bom-service";

export function useBoms() {
  return useQuery({
    queryKey: ["boms"],
    queryFn: bomService.list,
    placeholderData: (previous) => previous,
  });
}

/** Every item, for the finished-good and component pickers. Bounded server-side. */
export function useItemsForPickers() {
  return useQuery({
    queryKey: ["items", "pickers"],
    queryFn: () => itemService.all(),
    // A picker only needs the list once per session; item edits invalidate "items"
    // so this refetches with them.
    staleTime: 60_000,
  });
}

export function useCreateBom() {
  const { t } = useI18n();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BomInput) => bomService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms"] });
      toast.success(t.toast.bomCreated);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBom() {
  const { t } = useI18n();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BomPatch }) => bomService.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms"] });
      toast.success(t.toast.bomUpdated);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBom() {
  const { t } = useI18n();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bomService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms"] });
      toast.success(t.toast.bomDeleted);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}