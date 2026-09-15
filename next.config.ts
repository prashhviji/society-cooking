import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets several `next dev` instances run side by side during parallel agent
  // work (COOKWISE_DIST_DIR=.next-agent-x npx next dev -p 31xx). Unset in normal use.
  distDir: process.env.COOKWISE_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // The service worker must never be served from cache, or a stale
        // worker keeps controlling the app after a deploy. Service-Worker-Allowed
        // lets it claim the whole origin even though it lives in /public.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
