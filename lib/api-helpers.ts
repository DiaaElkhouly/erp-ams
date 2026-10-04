import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiError } from "@/lib/api-error";
import { canAccess, type ModuleKey } from "@/lib/rbac";
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
  // Bad quantities from a planner: a 422 rather than a 500, because the request
  // is at fault and a client retrying it unchanged will fail the same way.
  if (err instanceof RangeError || err instanceof TypeError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
