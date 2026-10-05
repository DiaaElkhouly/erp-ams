import { afterEach, describe, expect, it } from "vitest";
import { appOrigin, emailConfigured, passwordResetEmail } from "@/lib/email";

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_FROM", "AUTH_URL", "NEXTAUTH_URL", "VERCEL_URL"] as const;

const original = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const [key, value] of original) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("emailConfigured", () => {
  it("is false without a provider key, so local runs degrade instead of throwing", () => {
    delete process.env.RESEND_API_KEY;
    expect(emailConfigured()).toBe(false);
  });

  it("is true once a key is present", () => {
    process.env.RESEND_API_KEY = "re_test";
    expect(emailConfigured()).toBe(true);
  });

  it("ignores a blank key", () => {
    // A key that survives templating as an empty string would 401 on every send.
    process.env.RESEND_API_KEY = "   ";
    expect(emailConfigured()).toBe(false);
  });
});

describe("appOrigin", () => {
  it("prefers AUTH_URL and strips a trailing slash", () => {
    process.env.AUTH_URL = "https://ims.example.com/";
    expect(appOrigin()).toBe("https://ims.example.com");
  });

  it("falls back to NEXTAUTH_URL", () => {
    delete process.env.AUTH_URL;
    process.env.NEXTAUTH_URL = "https://legacy.example.com";
    expect(appOrigin()).toBe("https://legacy.example.com");
  });

  it("falls back to localhost so a local run produces working links", () => {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;
    expect(appOrigin()).toBe("http://localhost:3000");
  });
});

describe("passwordResetEmail", () => {
  const url = "https://ims.example.com/reset-password?token=abc123";

  it("puts the reset link on the call-to-action button", () => {
    // The regression this guards: a template that renders the URL only as plain
    // text leaves the inbox with something to copy but nothing to click.
    const { html } = passwordResetEmail(url, 30);
    expect(html).toContain(`<a href="${url}"`);
  });

  it("escapes the URL so markup in it cannot break the email", () => {
    const { html } = passwordResetEmail('https://x/reset?token=a&b="c"<script>', 30);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });

  it("states how long the link is valid for", () => {
    expect(passwordResetEmail(url, 30).html).toContain("30 minutes");
  });

  it("has a subject", () => {
    expect(passwordResetEmail(url, 30).subject).toMatch(/password/i);
  });
});