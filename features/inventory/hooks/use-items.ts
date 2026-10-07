"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { itemService, type ItemInput, type ItemListParams, type ItemPatch } from "../services/item-service";

export const ITEMS_PAGE_SIZE = 20;

/**
 * The paged, sorted item list.
 *
 * page/pageSize/sortBy/sortDir are all part of the query key, so TanStack caches
 * each page and sort order separately. That is what makes paging instant and
 * what makes going back to page 1 after an edit show the edited row without a
 * round trip.
 */
export function useItems(params: ItemListParams = {}) {
  const { q = "", type, isActive, lowStock, page = 1, pageSize = ITEMS_PAGE_SIZE, sortBy, sortDir } = params;
  return useQuery({
    queryKey: ["items", "list", { q, type, isActive, lowStock, page, pageSize, sortBy, sortDir }],
    queryFn: () => itemService.list(params),
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to five skeleton rows on every page turn.
    placeholderData: (previous) => previous,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => itemService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => itemService.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => itemService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}