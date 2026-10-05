"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { notificationService } from "../services/notification-service";

export function useNotifications(take = 20) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.list(take),
  });
}

export function useSetNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => notificationService.setRead(id, read),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReadAllNotifications() {
  const { t } = useI18n();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.readAll(),
    onSuccess: ({ dismissed }) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (dismissed > 0) toast.success(t.notifications.markedRead(dismissed));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}