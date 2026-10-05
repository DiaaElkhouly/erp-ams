import { onlineManager } from "@tanstack/react-query";
import { offlineDb, type OutboxItem } from "./db";

let isReplaying = false;

export async function enqueueMutation(
  url: string,
  method: string,
  body: any,
  idempotencyKey?: string
): Promise<OutboxItem> {
  const key = idempotencyKey || crypto.randomUUID();
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    url,
    method,
    body,
    idempotencyKey: key,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  };
  await offlineDb.outbox.add(item);
  return item;
}

export async function replayOutbox(): Promise<void> {
  if (isReplaying || !onlineManager.isOnline()) {
    return;
  }
  isReplaying = true;
  try {
    const items = await offlineDb.outbox
      .where("status")
      .anyOf("pending", "failed", "retrying")
      .sortBy("createdAt");

    for (const item of items) {
      if (!onlineManager.isOnline()) {
        break;
      }
      try {
        item.attempts += 1;
        item.status = "retrying";
        await offlineDb.outbox.put(item);

        const res = await fetch(item.url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": item.idempotencyKey,
          },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });

        if (res.status === 401) {
          item.status = "failed";
          await offlineDb.outbox.put(item);
          // Pause on auth expiry - prompt re-login without discarding queue
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          break;
        }

        if (res.ok) {
          await offlineDb.outbox.delete(item.id);
        } else {
          item.status = "failed";
          await offlineDb.outbox.put(item);
        }
      } catch (err) {
        item.status = "failed";
        await offlineDb.outbox.put(item);
      }
    }
  } finally {
    isReplaying = false;
  }
}

export function setupOutboxReplayer(): void {
  if (typeof window === "undefined") return;

  onlineManager.subscribe(() => {
    void replayOutbox();
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void replayOutbox();
    }
  });

  // Also trigger on online event as backup
  window.addEventListener("online", () => {
    void replayOutbox();
  });
}
