const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** "2026-10-02" -> "02 OCT" */
export function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]}`;
}

/** "2026-10-02" -> "FRI 02 OCT 2026" */
export function longDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const weekday = WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[Number(m) - 1]} ${y}`;
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
