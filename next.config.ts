import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits on top of the spine's theme switch.
  devIndicators: false,
  experimental: {
    // Visited (dynamic) and fully prefetched (static) pages stay in the client cache, so the spine
    // and back/forward open instantly. Live updates (router.refresh) and every server action purge it,
    // and a page shown from it that's more than a few seconds old re-reads itself once (<LiveRefresh>, <CatchUp>).
    staleTimes: { dynamic: 120, static: 300 },
  },
};

export default nextConfig;
