"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Older than this when the page mounts, it came from the client cache (a prefetch or a revisit).
 * Longer than a board's catch-up: assignments and mentions already refresh these pages live through
 * the inbox subscription, and a refresh empties the client cache, so the spine prefetches again.
 */
const CATCH_UP_AFTER_MS = 60_000;

/**
 * Stale-while-revalidate for pages without a live subscription: the cached page shows at once,
 * then re-reads itself in the background if it was rendered a while ago.
 */
export function CatchUp({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();

  useEffect(() => {
    if (Date.now() - renderedAt > CATCH_UP_AFTER_MS) router.refresh();
    // Once per mount: the refreshed render carries a new timestamp but needs no second check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
