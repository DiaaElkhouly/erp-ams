export interface Notification {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  notifications: Notification[];
  unreadCount: number;
}

async function handle(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return res;
}

export const notificationService = {
  list: (take = 20): Promise<NotificationFeed> =>
    fetch(`/api/notifications?take=${take}`).then(handle).then((res) => res.json()),

  setRead: (id: string, read: boolean): Promise<{ id: string; read: boolean; unreadCount: number }> =>
    fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    })
      .then(handle)
      .then((res) => res.json()),

  readAll: (): Promise<{ dismissed: number; unreadCount: number }> =>
    fetch("/api/notifications/read-all", { method: "POST" })
      .then(handle)
      .then((res) => res.json()),
};