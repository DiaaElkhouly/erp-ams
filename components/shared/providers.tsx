"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/lib/i18n";
import { setupOutboxReplayer } from "@/lib/offline/outbox";
import { createIdbPersister } from "@/lib/offline/query-persister";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors position="top-right" theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
  }));

  // Built per-mount rather than at module scope: a module-level `typeof window`
  // check is evaluated once at import time, so the value it produced on the server
  // could be baked into the client bundle.
  const [persister] = useState(createIdbPersister);

  useEffect(() => {
    setupOutboxReplayer();
  }, []);

  return (
    <SessionProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // Bump to invalidate every persisted cache in the wild. Required whenever a
          // response shape changes, since a stale cached shape cannot be repaired in place.
          buster: "v1",
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
