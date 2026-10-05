import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const schema = z.object({
  /** Omit to mark unread again. Present and false is the same thing. */
  read: z.boolean().default(true),
});

/**
 * Marks one notification read or unread for the signed-in user only.
 *
 * The read flag is a NotificationRead row rather than a column on Notification,
 * so dismissing an alert here does not dismiss it for everybody else.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireModuleAccess("notifications");
  if (error) return error;
  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    const userId = session!.user.id;

    const notification = await db.notification.findUnique({ where: { id }, select: { id: true } });
    if (!notification) throw notFound("Notification not found");

    if (body.read) {
      await db.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: id, userId } },
        create: { notificationId: id, userId },
        update: { readAt: new Date() },
      });
    } else {
      await db.notificationRead.deleteMany({ where: { notificationId: id, userId } });
    }

    const unreadCount = await db.notification.count({ where: { reads: { none: { userId } } } });
    return NextResponse.json({ id, read: body.read, unreadCount });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Dismissal is per-user and reversible, so this drops the row, not the alert. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireModuleAccess("notifications");
  if (error) return error;
  try {
    const { id } = await params;
    await db.notificationRead.deleteMany({ where: { notificationId: id, userId: session!.user.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}