import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { parsePaging, parseSort, type SortDirection } from "@/lib/api-query";

const itemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["RAW_MATERIAL", "COMPONENT", "FINISHED_GOOD", "CONSUMABLE"]),
  unit: z.string().default("pcs"),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  reorderPoint: z.coerce.number().int().nonnegative().default(0),
  reorderQty: z.coerce.number().int().nonnegative().default(0),
  /** Where an MRP suggestion for this item should be ordered from. */
  preferredSupplierId: z.string().min(1).nullable().optional(),
});

/** Columns the list endpoint will order by. Anything else is ignored. */
const SORTABLE = ["sku", "name", "type", "costPrice", "salePrice", "reorderPoint", "reorderQty", "onHand", "createdAt", "updatedAt"] as const;
type SortableColumn = (typeof SORTABLE)[number];

const itemInclude = { stockLevels: { include: { warehouse: true } }, preferredSupplier: true } as const;

/**
 * Orders ids by summed stock across every warehouse.
 *
 * Prisma cannot sort a parent by an aggregate over a child relation, and on-hand
 * is the column a warehouse manager actually sorts by, so this resolves the
 * order by hand and then re-reads only the page. The cost is one id list per
 * request, which is why the page is sliced before the rows are fetched rather
 * than after.
 */
async function orderIdsByOnHand(
  where: Prisma.ItemWhereInput,
  direction: SortDirection,
  lowStockOnly = false
): Promise<{ ids: string[]; total: number }> {
  const [items, grouped] = await Promise.all([
    db.item.findMany({ where, select: { id: true, reorderPoint: true } }),
    // Scoped to the same filter, or this aggregates the whole stock table.
    db.stockLevel.groupBy({ by: ["itemId"], where: { item: where }, _sum: { quantity: true } }),
  ]);

  const onHandByItem = new Map(grouped.map((row) => [row.itemId, row._sum.quantity ?? 0]));
  const multiplier = direction === "asc" ? 1 : -1;
  const eligible = lowStockOnly
    ? items.filter((item) => (onHandByItem.get(item.id) ?? 0) <= item.reorderPoint)
    : items;
  const ordered = eligible
    .map((item) => item.id)
    .sort((a, b) => {
      const difference = (onHandByItem.get(a) ?? 0) - (onHandByItem.get(b) ?? 0);
      // Ties fall back to id so paging through an on-hand sort is stable; without
      // a total order Postgres is free to return the same row on two pages.
      return difference !== 0 ? difference * multiplier : a.localeCompare(b);
    });

  return { ids: ordered, total: ordered.length };
}

export async function GET(req: NextRequest) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  // Only filters when asked. Defaulting to active-only would silently hide rows
  // from the BOM and order pickers, which ask for every item regardless of state.
  const active = searchParams.get("isActive");
  const lowStock = searchParams.get("lowStock") === "true";
  const { page, pageSize, skip, take } = parsePaging(searchParams);
  const { sortBy, sortDir } = parseSort<SortableColumn>(searchParams, SORTABLE, {
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
  });

  const where: Prisma.ItemWhereInput = {
    AND: [
      q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {},
      type ? { type: type as Prisma.ItemWhereInput["type"] } : {},
      active === "true" || active === "false" ? { isActive: active === "true" } : {},
    ],
  };

  try {
    if (sortBy === "onHand" || lowStock) {
      const { ids, total } = await orderIdsByOnHand(where, sortDir, lowStock);
      const pageIds = ids.slice(skip, skip + take);
      const items = await db.item.findMany({
        where: { id: { in: pageIds } },
        include: itemInclude,
      });
      const byId = new Map(items.map((item) => [item.id, item]));
      // Restore the computed order: `in` gives no ordering guarantee.
      return NextResponse.json({ items: pageIds.map((id) => byId.get(id)).filter(Boolean), total, page, pageSize });
    }

    const orderBy: Prisma.ItemOrderByWithRelationInput = { [sortBy ?? "createdAt"]: sortDir };
    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        include: itemInclude,
        // A stable secondary key, so paging cannot repeat or skip a row when the
        // primary column ties.
        orderBy: [{ ...orderBy }, { id: "asc" }],
        skip,
        take,
      }),
      db.item.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;

  try {
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "ITEM", (data: any) => data?.id, async () => {
      const body = itemSchema.parse(await req.json());
      const item = await db.item.create({ data: body });
      return { data: item, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}