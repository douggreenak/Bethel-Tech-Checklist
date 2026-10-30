export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number;
  minute: number;
  second: number;
}

export function getZonedParts(date: Date | number, timeZone: string): ZonedParts {
  const d = typeof date === "number" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const hour = map.hour === "24" ? 0 : parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[map.weekday] ?? 0;

  return { year, month, day, dayOfWeek, hour, minute, second };
}

export function getMondayOfDate(year: number, month: number, day: number, dayOfWeek: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayIndex = (dayOfWeek + 6) % 7; // Monday = 0, ..., Sunday = 6
  utc.setUTCDate(utc.getUTCDate() - dayIndex);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekKey(date: Date | number = Date.now(), timeZone: string = "America/Chicago"): string {
  const parts = getZonedParts(date, timeZone);
  return getMondayOfDate(parts.year, parts.month, parts.day, parts.dayOfWeek);
}

export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  timeZone: string
): number {
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  const targetMs = guess.getTime();
  const p1 = getZonedParts(guess, timeZone);
  const actualMs1 = Date.UTC(p1.year, p1.month - 1, p1.day, p1.hour, p1.minute, p1.second);
  const offset = actualMs1 - targetMs;
  const exact = new Date(targetMs - offset);

  // Refine for edge cases (e.g. DST boundary)
  const p2 = getZonedParts(exact, timeZone);
  const actualMs2 = Date.UTC(p2.year, p2.month - 1, p2.day, p2.hour, p2.minute, p2.second);
  const diff = actualMs2 - targetMs;
  return exact.getTime() - diff;
}

export function calculateDueMoment({
  mondayKey,
  dueTime,
  dueDay = 0,
  timeZone = "America/Chicago",
}: {
  mondayKey: string;
  dueTime: string;
  dueDay?: number | null;
  timeZone?: string;
}): number {
  const effectiveDay = dueDay ?? 0;
  const dayIndex = (effectiveDay + 6) % 7;
  const [yStr, mStr, dStr] = mondayKey.split("-");
  const baseUtc = new Date(Date.UTC(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10)));
  baseUtc.setUTCDate(baseUtc.getUTCDate() + dayIndex);

  const targetYear = baseUtc.getUTCFullYear();
  const targetMonth = baseUtc.getUTCMonth() + 1;
  const targetDay = baseUtc.getUTCDate();

  const [hStr, minStr] = dueTime.split(":");
  const hours = parseInt(hStr || "0", 10);
  const minutes = parseInt(minStr || "0", 10);

  return zonedWallTimeToUtc(targetYear, targetMonth, targetDay, hours, minutes, 0, timeZone);
}

export function isOverdue({
  done,
  taskDueTime,
  categoryDueTime,
  categoryDueDay,
  now = Date.now(),
  startedAt = null,
  currentWeekMonday,
  timeZone = "America/Chicago",
}: {
  done: boolean;
  taskDueTime?: string | null;
  categoryDueTime?: string | null;
  categoryDueDay?: number | null;
  now?: number | Date;
  startedAt?: number | Date | null;
  currentWeekMonday?: string;
  timeZone?: string;
}): boolean {
  if (done) return false;
  const effectiveTime = (taskDueTime && taskDueTime.trim()) || (categoryDueTime && categoryDueTime.trim()) || "";
  if (!effectiveTime) return false;

  const nowMs = typeof now === "number" ? now : now.getTime();
  const startedMs = startedAt ? (typeof startedAt === "number" ? startedAt : startedAt.getTime()) : 0;

  const mondayKey = currentWeekMonday || weekKey(nowMs, timeZone);
  const dueMomentMs = calculateDueMoment({
    mondayKey,
    dueTime: effectiveTime,
    dueDay: categoryDueDay ?? 0,
    timeZone,
  });

  return nowMs > dueMomentMs && dueMomentMs > startedMs;
}

export function formatDueText({
  done,
  overdue,
  dueTime,
  dueDay,
  now = Date.now(),
  timeZone = "America/Chicago",
}: {
  done: boolean;
  overdue: boolean;
  dueTime?: string | null;
  dueDay?: number | null;
  now?: number | Date;
  timeZone?: string;
}): string {
  if (done || !dueTime) return "";
  const parts = getZonedParts(now, timeZone);
  const todayDay = parts.dayOfWeek;
  const day = typeof dueDay === "number" ? dueDay : 0;

  const [hStr, mStr] = dueTime.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, "0");
  const timeFormatted = `${displayH}:${displayM} ${ampm}`;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const prefix = overdue ? "Past due: " : "Due ";
  const dayPrefix = day === todayDay ? "" : `${dayNames[day]} `;

  return `${prefix}${dayPrefix}${timeFormatted}`;
}

export function formatDoneText(
  checkedAt: string | Date | number | null | undefined,
  timeZone = "America/Chicago"
): string {
  if (!checkedAt) return "Done";
  const d =
    typeof checkedAt === "string" || typeof checkedAt === "number"
      ? new Date(checkedAt)
      : checkedAt;
  const parts = getZonedParts(d, timeZone);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ampm = parts.hour >= 12 ? "PM" : "AM";
  const displayH = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  const displayM = String(parts.minute).padStart(2, "0");
  return `Done ${dayNames[parts.dayOfWeek]} ${displayH}:${displayM} ${ampm}`;
}

export function formatWeekSubtitle(mondayKey: string): string {
  const [yStr, mStr, dStr] = mondayKey.split("-");
  const mon = new Date(Date.UTC(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10)));
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m1 = months[mon.getUTCMonth()];
  const d1 = mon.getUTCDate();
  const m2 = months[sun.getUTCMonth()];
  const d2 = sun.getUTCDate();

  if (m1 === m2) {
    return `Week of ${m1} ${d1} \u2013 ${d2}`;
  }
  return `Week of ${m1} ${d1} \u2013 ${m2} ${d2}`;
}
