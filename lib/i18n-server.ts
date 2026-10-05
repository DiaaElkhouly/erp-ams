import { cookies } from "next/headers";
import { getMessages, LOCALE_COOKIE, resolveLocale } from "@/lib/i18n-messages";

/**
 * The catalog for a server component.
 *
 * `useI18n` is a client hook, and the pages that fetch their data on the server
 * (reports, dashboard, finance) still need to render their headings and column
 * labels in the user's language. The locale therefore travels in a cookie that
 * `I18nProvider` mirrors from localStorage.
 *
 * Kept in its own module so `next/headers` never reaches the client bundle. The
 * catalog is imported from `lib/i18n-messages` rather than `lib/i18n` because the
 * latter is marked "use client", which would make `getMessages` a client reference
 * the server is not allowed to call.
 */
export async function getServerI18n() {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  return { locale, t: getMessages(locale) };
}