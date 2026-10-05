import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireModuleAccess } from "@/lib/api-helpers";

/**
 * Unread notifications for the signed-in user, newest first.
 *
 * Only unread rows are returned: the bell is a to-do list, not a history, and a
 * feed that never shrinks stops being read. `unreadCount` is separate because
 * the badge needs the total while the dropdown only needs a screenful.
 */
export async function GET(req: NextRequest) {
  const { session, error } = await requireModuleAccess("notifications");
  if (error) return error;

  const userId = session!.user.id;
  const take = Math.min(Math.max(Number(new URL(req.url).searchParams.get("take") ?? 20) || 20, 1), 100);

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { reads: { none: { userId } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.notification.count({ where: { reads: { none: { userId } } } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}