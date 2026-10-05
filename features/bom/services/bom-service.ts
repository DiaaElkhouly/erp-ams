export type BomComponentInput = { itemId: string; quantity: number };

export type Bom = {
  id: string;
  name: string;
  version: string;
  isActive: boolean;
  finishedItemId: string;
  finishedItem?: { id: string; sku: string; name: string } | null;
  components: { id: string; itemId: string; quantity: string | number; item?: { sku: string; name: string; unit: string } }[];
  /** Present on list reads: a BOM with work orders cannot have its composition changed. */
  _count?: { workOrders: number };
};

export type BomInput = {
  name: string;
  finishedItemId: string;
  version: string;
  components: BomComponentInput[];
};

/**
 * PATCH is narrower than BomInput: `components` and `finishedItemId` are refused
 * once the BOM has work orders, and omitting them leaves them untouched.
 */
export type BomPatch = Partial<BomInput> & { isActive?: boolean };

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export const bomService = {
  list: (): Promise<{ boms: Bom[] }> => fetch("/api/boms").then(handle),
  create: (input: BomInput): Promise<Bom> =>
    fetch("/api/boms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then(handle),
  update: (id: string, patch: BomPatch): Promise<Bom> =>
    fetch(`/api/boms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(handle),
  remove: (id: string): Promise<{ success: boolean }> =>
    fetch(`/api/boms/${id}`, { method: "DELETE" }).then(handle),
};