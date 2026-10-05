import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/query-persist-client-core";

/**
 * Persists the React Query cache to IndexedDB.
 *
 * Written by hand rather than pulled from `@tanstack/query-sync-storage-persister`
 * because the interface is three methods, and hand-writing it avoids depending on a
 * third TanStack package that must stay version-aligned with `@tanstack/react-query`.
 *
 * `persistClient` / `restoreClient` / `removeClient` are exactly the contract
 * `persistQueryClientSave` and `persistQueryClientRestore` call. They are NOT the
 * methods returned by `experimental_createQueryPersister`, which is the
 * fine-grained persister for a single `useQuery({ persister })` and exposes a
 * different surface (`persisterFn`, `persistQuery`, `retrieveQuery`, ...).
 * Passing that one here is what caused
 * `TypeError: persister.persistClient is not a function`.
 */

const STORAGE_KEY = "ims-query-cache";

export function createIdbPersister(): Persister {
  return {
    async persistClient(persisted: PersistedClient) {
      // Stored verbatim. `buster` belongs to the provider: it compares the stored
      // value against `persistOptions.buster` on restore and discards the cache on
      // mismatch, so rewriting it here would silently discard the whole cache on
      // every load.
      await set(STORAGE_KEY, persisted);
    },

    async restoreClient() {
      const stored = await get<PersistedClient>(STORAGE_KEY);
      // Nothing stored is the normal first-run case, not a failure. Returning
      // undefined makes restore a no-op instead of an error.
      return stored ?? undefined;
    },

    async removeClient() {
      await del(STORAGE_KEY);
    },
  };
}
