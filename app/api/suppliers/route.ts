import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function GET() {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  const suppliers = await db.supplier.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "SUPPLIER", (data: any) => data?.id, async () => {
      const body = schema.parse(await req.json());
      const supplier = await db.supplier.create({ data: body });
      return { data: supplier, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
