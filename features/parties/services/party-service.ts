/**
 * Customers and suppliers.
 *
 * The two tables have identical shapes and identical forms, so they share one
 * client module rather than a near-duplicate pair. What differs is the route and
 * the RBAC module, both passed in as `base`.
 */

export type PartyKind = "customers" | "suppliers";

export type Party = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt?: string;
};

/**
 * POST accepts the same nullable fields as PATCH: the form sends `null` for a
 * cleared box rather than omitting the key, so both verbs share one shape.
 */
export type PartyInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

/** Every field is optional so a form can send a partial edit. */
export type PartyPatch = Partial<PartyInput>;

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export function partyService(base: PartyKind) {
  return {
    list: (): Promise<Record<PartyKind, Party[]>> => fetch(`/api/${base}`).then(handle),
    create: (input: PartyInput): Promise<Party> =>
      fetch(`/api/${base}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(handle),
    update: (id: string, patch: PartyPatch): Promise<Party> =>
      fetch(`/api/${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(handle),
    remove: (id: string): Promise<{ success: boolean }> =>
      fetch(`/api/${base}/${id}`, { method: "DELETE" }).then(handle),
  };
}

export const customerService = partyService("customers");
export const supplierService = partyService("suppliers");