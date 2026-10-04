import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const schema = z.object({
  name: z.string().min(1),
  finishedItemId: z.string().min(1),
  version: z.string().default("1.0"),
  components: z.array(z.object({ itemId: z.string(), quantity: z.coerce.number().positive() })).min(1),
});

export async function GET() {
  const { error } = await requireModuleAccess("bom");
  if (error) return error;
  const boms = await db.bom.findMany({
    include: { finishedItem: true, components: { include: { item: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ boms });
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("bom");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const bom = await db.bom.create({
      data: {
        name: body.name,
        finishedItemId: body.finishedItemId,
        version: body.version,
        components: { create: body.components },
      },
      include: { finishedItem: true, components: { include: { item: true } } },
    });
    return NextResponse.json(bom, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
