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
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  const customers = await db.customer.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const customer = await db.customer.create({ data: body });
    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
