import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const schema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  department: z.string().min(1),
  position: z.string().min(1),
  hireDate: z.coerce.date().optional(),
  salary: z.coerce.number().nonnegative().optional(),
  userId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;

  const params = new URL(req.url).searchParams;
  const department = params.get("department") ?? undefined;
  const q = params.get("q") ?? undefined;

  const employees = await db.employee.findMany({
    where: {
      ...(department ? { department } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { employeeCode: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "EMPLOYEE", (data: any) => data?.id, async () => {
      const employee = await db.employee.create({
        data: {
          ...body,
          // The column is a unique nullable string; an empty string from the form
          // would collide with the next empty string on a second such employee.
          email: body.email || null,
        },
      });
      return { data: employee, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}