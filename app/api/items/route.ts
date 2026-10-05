import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

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
});

export async function GET(req: NextRequest) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  const where = {
    AND: [
      q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }] } : {},
      type ? { type: type as any } : {},
    ],
  };

  try {
    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        include: { stockLevels: { include: { warehouse: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
