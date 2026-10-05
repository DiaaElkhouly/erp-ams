"use server";

import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { appOrigin, passwordResetEmail, sendEmail } from "@/lib/email";

const emailSchema = z.string().email();

const RESET_TTL_MINUTES = 30;

/**
 * Declared rather than inferred so `devResetUrl` is only visible on the success
 * branch and only when it was actually attached. Inference widens `success` to
 * `boolean`, which stops the caller narrowing and forces an `as any` at every
 * use - and an `as any` here would also hide the environment gate.
 */
type PasswordResetResult =
  | { success: true; message: string; devResetUrl?: string }
  | { success: false; message: string };

export async function requestPasswordReset(email: string): Promise<PasswordResetResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { success: false, message: "Enter a valid email address." };

  const user = await db.user.findUnique({ where: { email } });
  // Always return a generic success message to avoid leaking which emails exist.
  if (!user) return { success: true, message: "If that email exists, a reset link has been generated." };

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * RESET_TTL_MINUTES); // 30 minutes

  await db.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExp: expires },
  });

  const resetUrl = `${appOrigin()}/reset-password?token=${token}`;
  const { subject, html } = passwordResetEmail(resetUrl, RESET_TTL_MINUTES);
  const delivery = await sendEmail({ to: user.email, subject, html });

  if (!delivery.sent) {
    // The caller still gets the generic success message - telling them the send
    // failed would confirm the address exists. The token is already stored and
    // will expire on its own, so this is recoverable rather than a breach.
    console.error(
      delivery.reason === "not-configured"
        ? "[auth] Password reset email not sent: RESEND_API_KEY is not set."
        : `[auth] Password reset email not sent for ${user.id}: ${delivery.reason} ${delivery.detail ?? ""}`,
    );
  }

  return {
    success: true,
    message: "If that email exists, a reset link has been generated.",
    // The token is a bearer credential for this account's password. Returning it
    // outside development hands anyone who can trigger a reset a working reset.
    ...(process.env.NODE_ENV === "development" ? { devResetUrl: `/reset-password?token=${token}` } : {}),
  };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type PasswordChangeResult =
  | { success: true; message: string }
  | { success: false; message: string };

export async function resetPassword(input: { token: string; password: string }): Promise<PasswordChangeResult> {
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
