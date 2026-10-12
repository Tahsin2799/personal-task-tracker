const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10-02" -> "2 Oct" */
export function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "2026-10-02" -> "Fri 2 Oct 2026" */
export function longDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const weekday = WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${weekday} ${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function taskKey(boardKey: string, number: number) {
  return `${boardKey}-${number}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Each epic owns one line ink, chosen from a fixed set by its number. */
export function epicInk(epicNumber: number) {
  return `var(--ink-epic-${(epicNumber % 6) + 1})`;
}

export function formatPoints(points: number) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

export type RepeatUnit = "day" | "week" | "month" | "year";

/** "every week", "every 2 weeks", "daily" for a recurrence rule. */
export function repeatPhrase(every: number, unit: string) {
  if (every === 1) return { day: "daily", week: "weekly", month: "monthly", year: "yearly" }[unit] ?? `every ${unit}`;
  return `every ${every} ${unit}s`;
}
