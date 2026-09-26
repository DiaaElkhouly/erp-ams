import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
