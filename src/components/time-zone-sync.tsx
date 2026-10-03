"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveTimeZone } from "@/app/(app)/actions";

/**
 * Stores the browser's time zone in a cookie so "today" and "overdue" match the viewer's clock,
 * and on the profile so email reminders arrive in the viewer's morning.
 */
export function TimeZoneSync({ current, saved }: { current: string | undefined; saved: string }) {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
    if (tz && tz !== saved) void saveTimeZone(tz);
  }, [current, saved, router]);

  return null;
}
