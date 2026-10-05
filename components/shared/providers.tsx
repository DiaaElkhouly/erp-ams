"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { experimental_createQueryPersister } from "@tanstack/query-persist-client-core";
import { get, set, del } from "idb-keyval";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { setupOutboxReplayer } from "@/lib/offline/outbox";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors position="top-right" theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}

const persister = typeof window !== "undefined"
  ? experimental_createQueryPersister({
      storage: {
        getItem: (key: string) => get(key),
        setItem: (key: string, value: unknown) => set(key, value),
        removeItem: (key: string) => del(key),
      },
    })
  : undefined;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
  }));

  useEffect(() => {
    setupOutboxReplayer();
  }, []);

  return (
    <SessionProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: persister as any,
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        }}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider>
            {children}
            <ThemedToaster />
          </I18nProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SessionProvider>
  );
}
