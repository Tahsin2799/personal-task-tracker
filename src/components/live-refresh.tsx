"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Watch = { table: string; filter?: string };

/** Older than this when the page mounts, the data came from the client cache: read it again once. */
const CATCH_UP_AFTER_MS = 15_000;

/**
 * Re-renders the page when watched rows change in Postgres (Supabase Realtime, filtered by RLS),
 * and tells open panels which table moved via a "board:changed" window event.
 * With `renderedAt`, a page shown from a prefetch catches up on what changed before it was opened.
 */
export function LiveRefresh({ channel, watch, renderedAt }: { channel: string; watch: Watch[]; renderedAt?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = JSON.stringify(watch);
  const renderedAtOnMount = useRef(renderedAt);

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
      // Subscribe first, then catch up, so nothing lands between the two.
      subscription.subscribe((status) => {
        const age = renderedAtOnMount.current ? Date.now() - renderedAtOnMount.current : 0;
        if (status === "SUBSCRIBED" && age > CATCH_UP_AFTER_MS) {
          renderedAtOnMount.current = undefined;
          router.refresh();
        }
      });
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (subscription) void supabase.removeChannel(subscription);
    };
  }, [channel, key, router]);

  return null;
}
