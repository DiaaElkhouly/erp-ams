import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError, requireModuleAccess } from "@/lib/api-helpers";

const testSchema = z.object({
  kind: z.literal("test"),
  category: z.string().min(1),
  material: z.string().min(1),
  testName: z.string().min(1),
  result: z.number().finite(),
  unit: z.string(),
  standard: z.string().optional().nullable(),
  minValue: z.number().finite().optional().nullable(),
  maxValue: z.number().finite().optional().nullable(),
  status: z.enum(["PASS", "FAIL", "REVIEW"]),
  details: z.record(z.string(), z.unknown()).optional().nullable(),
  /** Object key of the scanned certificate, written by the presigned upload flow. */
  attachmentKey: z.string().min(1).nullable().optional(),
});

const mixSchema = z.object({
  kind: z.literal("mix"),
  name: z.string().min(1),
  productType: z.string().min(1),
  requiredStrength: z.number().positive(),
  cementType: z.string().min(1),
  recipe: z.record(z.string(), z.unknown()),
  corrections: z.record(z.string(), z.unknown()),
  metrics: z.record(z.string(), z.unknown()),
  standard: z.string().nullable().optional(),
});

export async function GET() {
  const { error } = await requireModuleAccess("lab");
  if (error) return error;

  try {
    const [tests, mixDesigns] = await Promise.all([
      db.labTestRecord.findMany({ orderBy: { testedAt: "desc" }, take: 200 }),
      db.labMixDesign.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    ]);
    return NextResponse.json({ tests, mixDesigns });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("lab");
  if (error) return error;

  try {
    const body = await req.json();
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "LAB_RECORD", (data: any) => data?.id, async () => {
      if (body.kind === "test") {
        const { kind: _kind, ...data } = testSchema.parse(body);
        const record = await db.labTestRecord.create({
          data: { ...data, details: data.details ? data.details as Prisma.InputJsonValue : Prisma.DbNull },
        });
        return { data: record, status: 201 };
      }

      const { kind: _kind, ...data } = mixSchema.parse(body);
      const design = await db.labMixDesign.create({
        data: {
          ...data,
          recipe: data.recipe as Prisma.InputJsonValue,
          corrections: data.corrections as Prisma.InputJsonValue,
          metrics: data.metrics as Prisma.InputJsonValue,
        },
      });
      return { data: design, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}