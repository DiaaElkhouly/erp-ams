"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMessages, LOCALE_COOKIE, type Locale, type Messages } from "@/lib/i18n-messages";

export { getMessages, LOCALE_COOKIE };
export type { Locale, Messages };

type I18nContextValue = {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_COOKIE);
    if (savedLocale === "ar" || savedLocale === "en") setLocaleState(savedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(LOCALE_COOKIE, locale);
    // The cookie mirrors localStorage so server components render in the same
    // locale on the first paint instead of flashing the default.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => setLocaleState(nextLocale), []);

  // `t` is a constant per locale, so the context value only changes identity when
  // the locale itself does. Without this every consumer would re-render on any
  // parent render, which is the layout-thrash problem T4.4 removed.
  const value = useMemo<I18nContextValue>(
    () => ({ locale, direction: locale === "ar" ? "rtl" : "ltr", setLocale, t: getMessages(locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}