import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIFT,
  deriveStatus,
  minutesLate,
  summarizeAttendance,
  workedHours,
} from "@/lib/hr/attendance";

const SHIFT = { startTime: "08:00", graceMinutes: 15 };

/** Local-time constructor, because the shift is defined in local wall-clock time. */
function at(hours: number, minutes = 0) {
  return new Date(2026, 9, 5, hours, minutes, 0, 0);
}

describe("minutesLate", () => {
  it("is zero inside the grace window", () => {
    expect(minutesLate(at(8, 0), SHIFT)).toBe(0);
    expect(minutesLate(at(8, 15), SHIFT)).toBe(0);
  });

  it("counts minutes past the grace window", () => {
    expect(minutesLate(at(8, 16), SHIFT)).toBe(1);
    expect(minutesLate(at(9, 0), SHIFT)).toBe(45);
  });

  it("is zero for an early arrival", () => {
    expect(minutesLate(at(6, 30), SHIFT)).toBe(0);
  });

  it("respects a shift that does not start on the hour", () => {
    const shift = { startTime: "07:30", graceMinutes: 10 };
    expect(minutesLate(at(7, 40), shift)).toBe(0);
    expect(minutesLate(at(7, 41), shift)).toBe(1);
  });
});

describe("deriveStatus", () => {
  it("calls an on-time punch PRESENT and a late one LATE", () => {
    expect(deriveStatus(at(8, 0), at(16, 0), undefined, SHIFT)).toBe("PRESENT");
    expect(deriveStatus(at(9, 0), at(16, 0), undefined, SHIFT)).toBe("LATE");
  });

  it("treats no punch at all as ABSENT", () => {
    expect(deriveStatus(null, null, undefined, SHIFT)).toBe("ABSENT");
  });

  it("reads a missing check-in with a check-out as PRESENT, not ABSENT", () => {
    // One forgotten punch would otherwise fail the person for the whole day.
    expect(deriveStatus(null, at(16, 0), undefined, SHIFT)).toBe("PRESENT");
  });

  it("honours an explicit LEAVE over the punch data", () => {
    // Leave is granted by a supervisor, so a clock must not undo it.
    expect(deriveStatus(at(8, 0), at(16, 0), "LEAVE", SHIFT)).toBe("LEAVE");
    expect(deriveStatus(null, null, "LEAVE", SHIFT)).toBe("LEAVE");
  });

  it("honours an explicit ABSENT over a late punch", () => {
    expect(deriveStatus(at(10, 0), null, "ABSENT", SHIFT)).toBe("ABSENT");
  });

  it("uses the default shift when none is given", () => {
    expect(DEFAULT_SHIFT.startTime).toBe("08:00");
    expect(deriveStatus(at(8, 0), null)).toBe("PRESENT");
    expect(deriveStatus(at(9, 0), null)).toBe("LATE");
  });
});

describe("workedHours", () => {
  it("measures the gap between two punches", () => {
    expect(workedHours(at(8, 0), at(16, 30))).toEqual({ hours: 8.5, unreliable: false });
  });

  it("flags a single punch as unusable rather than guessing", () => {
    // Defaulting to 8 hours would put a wrong number into payroll.
    expect(workedHours(null, at(16, 0)).unreliable).toBe(true);
    expect(workedHours(at(8, 0), null).unreliable).toBe(true);
    expect(workedHours(null, null)).toEqual({ hours: 0, unreliable: true });
  });

  it("flags a check-out that precedes the check-in", () => {
    // A swapped pair would otherwise report a large negative day.
    expect(workedHours(at(16, 0), at(8, 0))).toEqual({ hours: 0, unreliable: true });
  });

  it("flags a zero-length shift", () => {
    expect(workedHours(at(8, 0), at(8, 0)).unreliable).toBe(true);
  });
});

describe("summarizeAttendance", () => {
  it("counts each status and rates attendance over present plus absent", () => {
    const summary = summarizeAttendance([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "ABSENT" },
      { status: "LEAVE" },
    ]);
    expect(summary).toEqual({
      present: 2,
      late: 1,
      absent: 1,
      leave: 1,
      attended: 3,
      // 3 attended / 4 countable. Leave is on neither side of the ratio.
      attendanceRatePercent: 75,
    });
  });

  it("reports zero rather than NaN with nothing to count", () => {
    expect(summarizeAttendance([]).attendanceRatePercent).toBe(0);
  });

  it("reports 100% when everyone attended and one was on leave", () => {
    const summary = summarizeAttendance([{ status: "PRESENT" }, { status: "LEAVE" }]);
    expect(summary.attendanceRatePercent).toBe(100);
  });
});