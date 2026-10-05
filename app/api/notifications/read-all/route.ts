import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

/**
 * Clears the bell for the signed-in user.
 *
 * The whole feed is dismissable at once because a stock alert is rarely the only
 * thing on screen after a busy shift, and nobody wants to click through thirty of
 * them one at a time.
 */
export async function POST() {
  const { session, error } = await requireModuleAccess("notifications");
  if (error) return error;
  try {
    const userId = session!.user.id;

    // Only rows this user has not already dismissed. Filtering first keeps the
    // insert from rewriting readAt on the ones that were.
    const unread = await db.notification.findMany({
      where: { reads: { none: { userId } } },
      select: { id: true },
    });

    if (unread.length > 0) {
      await db.notificationRead.createMany({
        data: unread.map((n) => ({ notificationId: n.id, userId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ dismissed: unread.length, unreadCount: 0 });
  } catch (err) {
    return handleApiError(err);
  }
}