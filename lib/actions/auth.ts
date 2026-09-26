"use server";

import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const emailSchema = z.string().email();

export async function requestPasswordReset(email: string) {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { success: false, message: "Enter a valid email address." };

  const user = await db.user.findUnique({ where: { email } });
  // Always return a generic success message to avoid leaking which emails exist.
  if (!user) return { success: true, message: "If that email exists, a reset link has been generated." };

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  await db.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExp: expires },
  });

  // In production this would be emailed. For local/dev use we return the link directly.
  return {
    success: true,
    message: "Reset link generated (dev mode — normally this would be emailed).",
    devResetUrl: `/reset-password?token=${token}`,
  };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPassword(input: { token: string; password: string }) {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await db.user.findUnique({ where: { resetToken: input.token } });
  if (!user || !user.resetTokenExp || user.resetTokenExp < new Date()) {
    return { success: false, message: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExp: null },
  });

  return { success: true, message: "Password updated. You can now sign in." };
}
