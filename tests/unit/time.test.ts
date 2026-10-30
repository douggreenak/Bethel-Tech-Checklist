import { describe, it, expect } from "vitest";
import {
  weekKey,
  getZonedParts,
  calculateDueMoment,
  isOverdue,
  formatDueText,
  formatDoneText,
} from "../../lib/time";

describe("lib/time", () => {
  const TZ = "America/Chicago";

  describe("weekKey", () => {
    it("differentiates Sunday 23:59:59 and Monday 00:00:00 in the team timezone", () => {
      // 2026-10-11 is Sunday in Chicago.
      // Sunday 23:59:59 CDT (UTC-5) is 2026-10-12 04:59:59 UTC
      const sundayNightUtc = new Date(Date.UTC(2026, 9, 12, 4, 59, 59));
      expect(getZonedParts(sundayNightUtc, TZ).dayOfWeek).toBe(0); // Sunday
      expect(weekKey(sundayNightUtc, TZ)).toBe("2026-10-05");

      // 1 second later: Monday 00:00:00 CDT is 2026-10-12 05:00:00 UTC
      const mondayMorningUtc = new Date(Date.UTC(2026, 9, 12, 5, 0, 0));
      expect(getZonedParts(mondayMorningUtc, TZ).dayOfWeek).toBe(1); // Monday
      expect(weekKey(mondayMorningUtc, TZ)).toBe("2026-10-12");
    });

    it("handles week boundary across a daylight saving time (DST) change", () => {
      // In America/Chicago, DST ends first Sunday of November: Nov 1, 2026.
      // Sunday Nov 1, 2026 (dayOfWeek = 0), Monday was Oct 26, 2026.
      const dstSunday = new Date("2026-11-01T18:00:00Z");
      expect(weekKey(dstSunday, TZ)).toBe("2026-10-26");

      // Monday Nov 2, 2026 after clocks turned back
      const dstMonday = new Date("2026-11-02T18:00:00Z");
      expect(weekKey(dstMonday, TZ)).toBe("2026-11-02");
    });
  });

  describe("isOverdue()", () => {
    // Current week Monday: 2026-10-05
    // Due day: Sunday (0) -> 2026-10-11 at 09:00:00 CDT
    // In Chicago (UTC-5), 09:00 CDT is 14:00 UTC on 2026-10-11
    const dueMomentMs = calculateDueMoment({
      mondayKey: "2026-10-05",
      dueTime: "09:00",
      dueDay: 0,
      timeZone: TZ,
    });

    it("is not overdue before the due moment", () => {
      const beforeNow = dueMomentMs - 60_000; // 1 minute before
      expect(
        isOverdue({
          done: false,
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: beforeNow,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(false);
    });

    it("is overdue after the due moment", () => {
      const afterNow = dueMomentMs + 60_000; // 1 minute after
      expect(
        isOverdue({
          done: false,
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: afterNow,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(true);
    });

    it("is NOT overdue when the due moment is earlier than started_at (start new week grace)", () => {
      // Suppose reset happened after the due moment (e.g. 10:00 AM on Sunday)
      const resetTime = dueMomentMs + 3600_000;
      const nowCheck = dueMomentMs + 7200_000; // 11:00 AM on Sunday

      expect(
        isOverdue({
          done: false,
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: nowCheck,
          startedAt: resetTime,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(false);
    });

    it("becomes overdue again the following week after a grace reset", () => {
      // Grace reset happened on Sunday 2026-10-11 at 10:00 AM (resetTime)
      const resetTime = dueMomentMs + 3600_000;

      // The next week Monday is 2026-10-12
      // Next Sunday (2026-10-18) at 09:00 AM
      const nextDueMomentMs = calculateDueMoment({
        mondayKey: "2026-10-12",
        dueTime: "09:00",
        dueDay: 0,
        timeZone: TZ,
      });

      const nextWeekCheck = nextDueMomentMs + 60_000; // Next Sunday 09:01 AM
      expect(
        isOverdue({
          done: false,
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: nextWeekCheck,
          startedAt: resetTime,
          currentWeekMonday: "2026-10-12",
          timeZone: TZ,
        })
      ).toBe(true);
    });

    it("task-level due time overrides category-level due time", () => {
      // Category is due at 09:00, task override is due at 11:00
      // At 10:00, category would be overdue, but task is NOT overdue
      const taskDueMoment = calculateDueMoment({
        mondayKey: "2026-10-05",
        dueTime: "11:00",
        dueDay: 0,
        timeZone: TZ,
      });

      const atTenAm = dueMomentMs + 3600_000; // 10:00 AM
      expect(
        isOverdue({
          done: false,
          taskDueTime: "11:00",
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: atTenAm,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(false);

      // Past 11:00 AM, task is overdue
      expect(
        isOverdue({
          done: false,
          taskDueTime: "11:00",
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: taskDueMoment + 60_000,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(true);
    });

    it("honors category due_day", () => {
      // Category due day is Thursday (4) at 19:00
      const thursdayDue = calculateDueMoment({
        mondayKey: "2026-10-05",
        dueTime: "19:00",
        dueDay: 4,
        timeZone: TZ,
      });

      // Wednesday (before)
      expect(
        isOverdue({
          done: false,
          categoryDueTime: "19:00",
          categoryDueDay: 4,
          now: thursdayDue - 3600_000,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(false);

      // Thursday after 19:00
      expect(
        isOverdue({
          done: false,
          categoryDueTime: "19:00",
          categoryDueDay: 4,
          now: thursdayDue + 3600_000,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(true);
    });

    it("done tasks are never overdue", () => {
      const afterNow = dueMomentMs + 60_000;
      expect(
        isOverdue({
          done: true,
          categoryDueTime: "09:00",
          categoryDueDay: 0,
          now: afterNow,
          currentWeekMonday: "2026-10-05",
          timeZone: TZ,
        })
      ).toBe(false);
    });
  });

  describe("formatDueText and formatDoneText", () => {
    it("formats due chip text with weekday when not today", () => {
      // Sunday in Chicago
      const sundayTime = new Date("2026-10-11T14:00:00Z");
      // due on Sunday
      const textToday = formatDueText({
        done: false,
        overdue: false,
        dueTime: "09:00",
        dueDay: 0,
        now: sundayTime,
        timeZone: TZ,
      });
      expect(textToday).toBe("Due 9:00 AM");

      // due on Thursday
      const textDifferentDay = formatDueText({
        done: false,
        overdue: false,
        dueTime: "19:00",
        dueDay: 4,
        now: sundayTime,
        timeZone: TZ,
      });
      expect(textDifferentDay).toBe("Due Thu 7:00 PM");

      // overdue
      const overdueText = formatDueText({
        done: false,
        overdue: true,
        dueTime: "09:00",
        dueDay: 0,
        now: sundayTime,
        timeZone: TZ,
      });
      expect(overdueText).toBe("Past due: 9:00 AM");
    });

    it("formats done line", () => {
      const checkedAt = new Date("2026-10-08T13:53:00Z"); // Thu 8:53 AM in Chicago (UTC-5)
      expect(formatDoneText(checkedAt, TZ)).toBe("Done Thu 8:53 AM");
      expect(formatDoneText(null)).toBe("Done");
    });
  });
});
