"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Stores the browser's time zone in a cookie so "today" and "overdue" match the viewer's clock. */
export function TimeZoneSync({ current }: { current: string | undefined }) {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [current, router]);

  return null;
}
