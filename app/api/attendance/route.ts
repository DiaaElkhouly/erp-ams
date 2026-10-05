import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { deriveStatus, summarizeAttendance } from "@/lib/hr/attendance";

const schema = z.object({
  employeeId: z.string().min(1),
  /** Day the record is for. Defaults to today. */
  date: z.coerce.date().optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;

  const params = new URL(req.url).searchParams;
  const date = params.get("date");
  const employeeId = params.get("employeeId") ?? undefined;

  const records = await db.attendance.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      // The column is DATE, so the bounds have to be day-wide in the caller's
      // local time; comparing against a bare timestamp would drop most of the day.
      ...(date ? { date: dayBounds(date) } : {}),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    orderBy: [{ date: "desc" }, { employee: { employeeCode: "asc" } }],
  });

  return NextResponse.json({ attendance: records, summary: summarizeAttendance(records) });
}

/** Turns a `YYYY-MM-DD` string into the full UTC day it names. */
function dayBounds(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) return undefined;
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return { gte: day, lt: next };
}

/**
 * Records a punch for one employee-day.
 *
 * Status is derived from the punches rather than taken on trust, so a client that
 * posts a 09:00 check-in cannot label it PRESENT when the shift started at 08:00.
 * An explicit ABSENT or LEAVE is honoured: those are decided by a supervisor, not
 * by a clock.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireModuleAccess("hr");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const status = deriveStatus(body.checkIn ?? null, body.checkOut ?? null, body.status);

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "ATTENDANCE", (data: any) => data?.id, async () => {
      const record = await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: body.employeeId,
            // The unique key is on the DATE column, so the day has to be truncated
            // to midnight before it will match a row written on the same day.
            date: truncateToDay(body.date ?? new Date()),
          },
        },
        create: {
          employeeId: body.employeeId,
          date: truncateToDay(body.date ?? new Date()),
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          status,
          notes: body.notes,
        },
        update: {
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          status,
          notes: body.notes,
        },
      });
      return { data: record, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * UTC midnight of the day the timestamp falls in.
 *
 * UTC rather than local because the column is a Postgres `date`, which Prisma
 * reads back as midnight UTC. Truncating in local time would miss the unique key
 * for anyone west of Greenwich on a date near midnight.
 */
function truncateToDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}