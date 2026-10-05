import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  type PersistedClient,
} from "@tanstack/query-persist-client-core";
import { createIdbPersister } from "@/lib/offline/query-persister";

// Stand-in for idb-keyval. The real module needs IndexedDB, which vitest's node
// environment does not provide, and the storage engine is not what these tests are
// asserting - the Persister contract is.
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const clientState = { mutations: [], queries: [] } as unknown as PersistedClient["clientState"];
const persisted: PersistedClient = {
  timestamp: Date.now(),
  buster: "v1",
  clientState,
};

beforeEach(() => {
  store.clear();
});

describe("createIdbPersister", () => {
  it("exposes the three methods persistQueryClient actually calls", () => {
    const persister = createIdbPersister();

    // These are the exact method names invoked by persistQueryClientRestore /
    // persistQueryClientSave. The original bug passed
    // experimental_createQueryPersister here, whose object has `persisterFn` /
    // `persistQuery` instead, so the provider threw
    // "persister.persistClient is not a function" at runtime.
    expect(typeof persister.persistClient).toBe("function");
    expect(typeof persister.restoreClient).toBe("function");
    expect(typeof persister.removeClient).toBe("function");
  });

  it("round-trips a persisted client", async () => {
    const persister = createIdbPersister();

    await persister.persistClient(persisted);
    expect(await persister.restoreClient()).toEqual(persisted);
  });

  it("returns undefined when nothing is stored, so first run is not an error", async () => {
    expect(await createIdbPersister().restoreClient()).toBeUndefined();
  });

  it("removes the stored client", async () => {
    const persister = createIdbPersister();
    await persister.persistClient(persisted);

    await persister.removeClient();
    expect(await persister.restoreClient()).toBeUndefined();
  });

  it("preserves the buster verbatim so restore-time comparison works", async () => {
    const persister = createIdbPersister();

    await persister.persistClient({ ...persisted, buster: "" });
    // PersistQueryClientProvider defaults buster to "" and discards the cache when
    // the stored value differs. A persister that rewrote buster would silently
    // throw away the whole cache on every load.
    expect((await persister.restoreClient())?.buster).toBe("");
  });
});

describe("integration with persistQueryClient*", () => {
  it("restores without throwing and preserves query data", async () => {
    const source = new QueryClient();
    source.setQueryData(["items", 1], { id: 1 });

    await persistQueryClientSave({
      queryClient: source,
      persister: createIdbPersister(),
      buster: "v1",
    });

    const target = new QueryClient();
    await persistQueryClientRestore({
      queryClient: target,
      persister: createIdbPersister(),
      buster: "v1",
    });

    expect(target.getQueryData(["items", 1])).toEqual({ id: 1 });
  });

  it("discards a cache written under a different buster", async () => {
    const source = new QueryClient();
    source.setQueryData(["items", 1], { id: 1 });
    await persistQueryClientSave({ queryClient: source, persister: createIdbPersister(), buster: "old" });

    const target = new QueryClient();
    await persistQueryClientRestore({ queryClient: target, persister: createIdbPersister(), buster: "v1" });

    // Restore skips hydrate on a buster mismatch. It does not clear the target
    // client, so the assertion is that old data was not hydrated in, not that the
    // target was emptied.
    expect(target.getQueryData(["items", 1])).toBeUndefined();
    // ...and the stale entry is evicted, not left to fail the next comparison.
    expect(await createIdbPersister().restoreClient()).toBeUndefined();
  });
});
