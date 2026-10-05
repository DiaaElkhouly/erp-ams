export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  type: "RAW_MATERIAL" | "COMPONENT" | "FINISHED_GOOD" | "CONSUMABLE";
  unit: string;
  costPrice: string;
  salePrice: string;
  reorderPoint: number;
  reorderQty: number;
  isActive: boolean;
  photoKey?: string | null;
  preferredSupplierId?: string | null;
  stockLevels: { quantity: number; warehouse: { name: string } }[];
}

export interface ItemInput {
  sku: string;
  name: string;
  description?: string;
  type: Item["type"];
  unit: string;
  costPrice: number;
  salePrice: number;
  reorderPoint: number;
  reorderQty: number;
  preferredSupplierId?: string | null;
}

/** Fields PATCH accepts. Partial, and deliberately narrower than ItemInput. */
export type ItemPatch = Omit<Partial<ItemInput>, "description"> & {
  isActive?: boolean;
  /** Nullable: clearing an optional field is a real edit, not an omission. */
  description?: string | null;
  photoKey?: string | null;
};

export type ItemSortField =
  | "sku" | "name" | "type" | "costPrice" | "salePrice"
  | "reorderPoint" | "reorderQty" | "onHand" | "createdAt" | "updatedAt";

export type ItemListParams = {
  q?: string;
  type?: Item["type"];
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: ItemSortField;
  sortDir?: "asc" | "desc";
};

export type ItemListResponse = {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
};

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

function listUrl({ q = "", type, isActive, page = 1, pageSize = 20, sortBy, sortDir }: ItemListParams) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  // Only sent when set: the route treats an absent value as "no filter", and
  // sending isActive=false would silently empty the picker lists.
  if (isActive !== undefined) params.set("isActive", String(isActive));
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (sortBy) params.set("sortBy", sortBy);
  if (sortDir) params.set("sortDir", sortDir);
  return `/api/items?${params.toString()}`;
}

export const itemService = {
  list: (params: ItemListParams = {}): Promise<ItemListResponse> =>
    fetch(listUrl(params)).then(handle),
  /** Every item, for pickers and lookups. Bounded by the server's max page size. */
  all: (q = ""): Promise<ItemListResponse> =>
    fetch(listUrl({ q, pageSize: 200 })).then(handle),
  create: (input: ItemInput): Promise<Item> =>
    fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then(handle),
  update: (id: string, patch: ItemPatch): Promise<Item> =>
    fetch(`/api/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then(handle),
  remove: (id: string): Promise<{ success: boolean }> =>
    fetch(`/api/items/${id}`, { method: "DELETE" }).then(handle),
};