import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api-error";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export async function requireModuleAccess(module: ModuleKey) {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccess(session.user.role, module)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: err.flatten() }, { status: 422 });
  }
  // Domain failures carry their own status, e.g. InsufficientStockError is a 409.
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, ...(err.details === undefined ? {} : { details: err.details }) },
      { status: err.status },
    );
  }
  // A unique-constraint collision is a conflict with existing data, not a bug.
  // Retrying it unchanged fails identically, so 409 rather than 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const fields = Object.keys(err.meta?.target ?? {}).join(", ");
    return NextResponse.json({ error: fields ? `${fields} must be unique` : "Value must be unique" }, { status: 409 });
  }
  // A missing row: P2025 is what `update` throws for an unknown id.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Bad quantities from a planner: a 422 rather than a 500, because the request
  // is at fault and a client retrying it unchanged will fail the same way.
  if (err instanceof RangeError || err instanceof TypeError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
