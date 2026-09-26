import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
});

export async function GET() {
  const { error } = await requireModuleAccess("warehouse");
  if (error) return error;
  const warehouses = await db.warehouse.findMany({
    include: { stockLevels: { include: { item: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ warehouses });
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("warehouse");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const warehouse = await db.warehouse.create({ data: body });
    return NextResponse.json(warehouse, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
