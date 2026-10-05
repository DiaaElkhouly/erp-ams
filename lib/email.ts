/**
 * Outbound transactional email.
 *
 * Resend's REST API is called directly rather than through its SDK. The SDK
 * would be one more dependency for a single POST, and the payload is small enough
 * that there is nothing in it to abstract over.
 *
 * The whole module is a no-op when no provider is configured. That is deliberate:
 * a developer with no Resend account must still be able to reset a password, so
 * `sendEmail` reports that it did not send and leaves the caller to decide.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Falls back to a stripped copy of the HTML. */
  text?: string;
};

export type EmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "not-configured" | "rejected" | "provider-error"; detail?: string };

function apiKey() {
  return process.env.RESEND_API_KEY?.trim() || null;
}

function sender() {
  // Resend refuses to send from an unverified domain, so both halves are
  // configurable and the default only works on a domain already verified.
  return process.env.EMAIL_FROM?.trim() || "IMS <onboarding@resend.dev>";
}

export function emailConfigured(): boolean {
  return apiKey() !== null;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const key = apiKey();
  if (!key) return { sent: false, reason: "not-configured" };

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text ?? stripHtml(message.html),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 422 means Resend rejected the message itself - a bad address or an
    // unverified sender. Retrying will not help, so it is called out separately
    // from a transient 5xx.
    return res.status === 422
      ? { sent: false, reason: "rejected", detail }
      : { sent: false, reason: "provider-error", detail };
  }

  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: body.id ?? "" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The origin the emailed links point at.
 *
 * Falls back through the two names NextAuth accepts and then to localhost, so a
 * local run produces working links without any configuration at all.
 */
export function appOrigin(): string {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHELL_STYLE = "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6";

/**
 * Password reset email. Exported so the markup can be asserted without a
 * provider: a mail template is code, and untested templates are how reset links
 * end up rendering as raw angle brackets in an inbox.
 */
export function passwordResetEmail(resetUrl: string, expiresInMinutes: number): { subject: string; html: string } {
  const href = escapeHtml(resetUrl);
  return {
    subject: "Reset your IMS password",
    html: `<div style="${SHELL_STYLE}max-width:520px;margin:0 auto;color:#111">
  <h1 style="font-size:20px;margin:0 0 16px">Reset your IMS password</h1>
  <p>We received a request to reset the password for your IMS account.</p>
  <p style="margin:24px 0">
    <a href="${href}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">
      Choose a new password
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    This link expires in ${expiresInMinutes} minutes and can only be used once.
    If you did not request a reset, you can ignore this message - your password stays as it is.
  </p>
  <p style="color:#666;font-size:13px">If the button does not work, copy this link into your browser:<br>
    <span style="word-break:break-all">${href}</span>
  </p>
</div>`,
  };
}