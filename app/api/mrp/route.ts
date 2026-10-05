import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireModuleAccess("mrp");
  if (error) return error;
  const runs = await db.mrpRun.findMany({
    include: { lines: { include: { item: true } } },
    orderBy: { runAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ runs });
}

const schema = z.object({ name: z.string().min(1) });

// Simplified MRP: for every item with a reorder point, compare current total
// on-hand stock against open work-order + sales-order demand, and suggest a
// replenishment quantity when projected stock would fall below the reorder point.
export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("mrp");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());

    const items = await db.item.findMany({
      where: { isActive: true },
      include: { stockLevels: true },
    });

    const openSalesDemand = await db.salesOrderLine.groupBy({
      by: ["itemId"],
      where: { salesOrder: { status: { in: ["DRAFT", "CONFIRMED"] } } },
      _sum: { quantity: true },
    });
    const demandMap = new Map(openSalesDemand.map((d) => [d.itemId, d._sum.quantity ?? 0]));

    const lines = items
      .map((item) => {
        const onHand = item.stockLevels.reduce((sum, s) => sum + s.quantity, 0);
        const demand = demandMap.get(item.id) ?? 0;
        const projected = onHand - demand;
        const suggested = projected < item.reorderPoint ? Math.max(item.reorderQty, item.reorderPoint - projected) : 0;
        return { itemId: item.id, onHandQty: onHand, demandQty: demand, suggestedQty: suggested };
      })
      .filter((l) => l.suggestedQty > 0);

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "MRP_RUN", (data: any) => data?.id, async () => {
      const run = await db.mrpRun.create({
        data: { name: body.name, lines: { create: lines } },
        include: { lines: { include: { item: true } } },
      });

      return { data: run, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
