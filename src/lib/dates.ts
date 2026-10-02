import "server-only";
import { cookies } from "next/headers";

/** The viewer's IANA time zone, synced from the browser into a cookie by <TimeZoneSync>. */
export async function viewerTimeZone() {
  const raw = (await cookies()).get("tz")?.value;
  if (raw) {
    const tz = decodeURIComponent(raw);
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return tz;
    } catch {
      // fall through
    }
  }
  return "UTC";
}

/** Today's date as YYYY-MM-DD in the viewer's time zone. */
export async function viewerToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: await viewerTimeZone() }).format(new Date());
}

export { daysBetween } from "./day-math";
