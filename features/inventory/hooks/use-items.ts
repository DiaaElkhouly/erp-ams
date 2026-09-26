"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { itemService, type ItemInput } from "../services/item-service";

export function useItems(q = "") {
  return useQuery({ queryKey: ["items", q], queryFn: () => itemService.list(q) });
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
