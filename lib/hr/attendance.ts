/**
 * Attendance derivation, with no database and no framework.
 *
 * The interesting decisions in an attendance sheet - is a 08:07 arrival late, is a
 * missing punch an absence or a forgotten check-out - are all arithmetic and
 * comparisons. Keeping them here means they are testable without seeding a
 * database and without a clock that has to be frozen.
 */

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

export type AttendanceRecord = {
  employeeId: string;
  date: Date | string;
  checkIn: Date | string | null;
  checkOut: Date | string | null;
  status: AttendanceStatus;
};

export type ShiftPolicy = {
  /** Local start of the shift, e.g. "08:00". */
  startTime: string;
  /** Minutes after `startTime` that still count as on time. */
  graceMinutes: number;
};

export const DEFAULT_SHIFT: ShiftPolicy = { startTime: "08:00", graceMinutes: 15 };

function minutesOfDay(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getHours() * 60 + d.getMinutes();
}

function shiftStartMinutes(shift: ShiftPolicy): number {
  const [hours, minutes] = shift.startTime.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes an arrival is past the late threshold. Zero when it is on time. */
export function minutesLate(checkIn: Date | string, shift: ShiftPolicy = DEFAULT_SHIFT): number {
  const late = minutesOfDay(checkIn) - shiftStartMinutes(shift) - shift.graceMinutes;
  return late > 0 ? late : 0;
}

/**
 * The status implied by a pair of punches.
 *
 * LEAVE is passed through rather than inferred: leave is granted by someone else,
 * so a record that already says LEAVE must not be overwritten by punch data.
 *
 * A missing check-in with a check-out is a forgotten punch, not an absence - the
 * person demonstrably showed up at some point, and marking them ABSENT would fail
 * them twice for one clerical slip.
 */
export function deriveStatus(
  checkIn: Date | string | null,
  checkOut: Date | string | null,
  declared?: AttendanceStatus,
  shift: ShiftPolicy = DEFAULT_SHIFT,
): AttendanceStatus {
  if (declared === "LEAVE" || declared === "ABSENT") return declared;
  if (!checkIn) return checkOut ? "PRESENT" : "ABSENT";
  return minutesLate(checkIn, shift) > 0 ? "LATE" : "PRESENT";
}

export type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  leave: number;
  /** PRESENT + LATE. The number an HR review actually reads. */
  attended: number;
  /** attended / (attended + absent). Leave is excluded from both sides. */
  attendanceRatePercent: number;
};

export function summarizeAttendance(records: Pick<AttendanceRecord, "status">[]): AttendanceSummary {
  let present = 0;
  let late = 0;
  let absent = 0;
  let leave = 0;

  for (const record of records) {
    if (record.status === "PRESENT") present += 1;
    else if (record.status === "LATE") late += 1;
    else if (record.status === "ABSENT") absent += 1;
    else leave += 1;
  }

  const attended = present + late;
  const denominator = attended + absent;
  return {
    present,
    late,
    absent,
    leave,
    attended,
    attendanceRatePercent: denominator === 0 ? 0 : Math.round((attended / denominator) * 1000) / 10,
  };
}

export type WorkedHours = {
  hours: number;
  /** True when the pair is unusable: one punch missing, or the out before the in. */
  unreliable: boolean;
};

/**
 * Hours between two punches.
 *
 * Both punches are required and the order is checked. Guessing either one - an
 * 8-hour default, or a negative duration from a swapped pair - feeds a wrong
 * number into payroll, so the caller is told the reading is unusable instead.
 */
export function workedHours(checkIn: Date | string | null, checkOut: Date | string | null): WorkedHours {
  if (!checkIn || !checkOut) return { hours: 0, unreliable: true };

  const start = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === "string" ? new Date(checkOut) : checkOut;

  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return { hours: 0, unreliable: true };

  return { hours: Math.round((ms / 3_600_000) * 100) / 100, unreliable: false };
}