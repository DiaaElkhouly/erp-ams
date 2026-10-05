import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  department: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  hireDate: z.coerce.date().optional(),
  salary: z.coerce.number().nonnegative().nullable().optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  userId: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;
  try {
    const { id } = await params;
    const employee = await db.employee.findUnique({ where: { id } });
    if (!employee) throw notFound("Employee not found");
    return NextResponse.json(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "EMPLOYEE", (data: any) => data?.id ?? id, async () => {
      const employee = await db.employee.update({ where: { id }, data: body });
      return { data: employee };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Deletes the employee record. Attendance rows cascade with it.
 *
 * For a real HR system this would be a termination - the record has to survive as
 * evidence - and `status: TERMINATED` is the soft path. The hard delete stays for
 * correcting a record created in error.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "EMPLOYEE", () => id, async () => {
      await db.employee.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}