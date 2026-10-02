"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Watch = { table: string; filter?: string };

/**
 * Re-renders the page when watched rows change in Postgres (Supabase Realtime, filtered by RLS),
 * and tells open panels which table moved via a "board:changed" window event.
 */
export function LiveRefresh({ channel, watch }: { channel: string; watch: Watch[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = JSON.stringify(watch);

  useEffect(() => {
    const supabase = createClient();
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      // Realtime evaluates RLS as the socket's user: give it the signed-in session, not the anon key.
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      // A fresh topic per mount: re-joining a topic the server still holds (fast remounts) is rejected.
      subscription = supabase.channel(`${channel}:${crypto.randomUUID()}`);
      for (const w of JSON.parse(key) as Watch[]) {
        subscription.on("postgres_changes", { event: "*", schema: "public", table: w.table, filter: w.filter }, () => {
          window.dispatchEvent(new CustomEvent("board:changed", { detail: { table: w.table } }));
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 350);
        });
      }
      subscription.subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (subscription) void supabase.removeChannel(subscription);
    };
  }, [channel, key, router]);

  return null;
}
