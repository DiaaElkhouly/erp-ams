import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

/**
 * Every field but the name is optional and nullable: the columns are nullable, and
 * the register's form sends `null` for a cleared box so "no email" round-trips
 * instead of arriving as an empty string. `""` stays accepted for older clients.
 */
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().nullish(),
  address: z.string().nullish(),
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
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "CUSTOMER", (data: any) => data?.id, async () => {
      const body = schema.parse(await req.json());
      const customer = await db.customer.create({ data: body });
      return { data: customer, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
