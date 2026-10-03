import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits on top of the spine's theme switch.
  devIndicators: false,
  experimental: {
    // Keep visited pages in the client cache so going back to a board, My Work or the Inbox is instant.
    // Live updates (router.refresh) and every server action purge it, so it never shows stale work.
    staleTimes: { dynamic: 120, static: 600 },
  },
};

export default nextConfig;
