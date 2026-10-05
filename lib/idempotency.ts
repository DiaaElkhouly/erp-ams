import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export function getIdempotencyKey(req: NextRequest): string | null {
  const key = req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key") || req.headers.get("x-idempotency-key");
  return key;
}

export async function withIdempotency<T>(
  req: NextRequest,
  action: string,
  entity: string,
  getEntityId: (data: T) => string | null | undefined,
  execute: () => Promise<{ data: T; status?: number }>
): Promise<NextResponse<T>> {
  const key = getIdempotencyKey(req);
  if (!key) {
    const result = await execute();
    return NextResponse.json(result.data, { status: result.status ?? 200 }) as NextResponse<T>;
  }

  const existing = await db.auditLog.findFirst({
    where: {
      metadata: {
        string_contains: key,
      } as any,
    },
  });

  if (existing) {
    const meta = existing.metadata as any;
    if (meta?.idempotencyKey === key && meta?.cachedResponse) {
      return NextResponse.json(meta.cachedResponse.data, {
        status: meta.cachedResponse.status ?? 200,
      }) as NextResponse<T>;
    }
    if (meta?.idempotencyKey === key) {
      return NextResponse.json({ success: true } as any, { status: 200 }) as NextResponse<T>;
    }
  }

  const result = await execute();
  const responseData = result.data;
  const entityId = getEntityId(responseData) ?? null;

  await db.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      metadata: {
        idempotencyKey: key,
        cachedResponse: {
          data: responseData,
          status: result.status ?? 200,
        },
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(responseData, { status: result.status ?? 200 }) as NextResponse<T>;
}
