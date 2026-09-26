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
}

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export const itemService = {
  list: (q = ""): Promise<{ items: Item[]; total: number }> =>
    fetch(`/api/items?q=${encodeURIComponent(q)}`).then(handle),
  create: (input: ItemInput): Promise<Item> =>
    fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then(handle),
  remove: (id: string): Promise<{ success: boolean }> =>
    fetch(`/api/items/${id}`, { method: "DELETE" }).then(handle),
};
