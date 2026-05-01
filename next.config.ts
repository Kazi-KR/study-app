import type { NextConfig } from "next";

// Participant-flow routes that must never be served from bfcache or any other
// cache. Each page has server-side redirect logic that forwards a participant
// to whatever step they belong on next; if the browser restores a cached
// snapshot of an already-submitted page (e.g. via the back button) that logic
// is bypassed and the participant lands on a stale page that can produce
// duplicate-submit errors. Setting `Cache-Control: no-store` opts the response
// out of the bfcache and forces a fresh server render every visit, so the
// redirects always run.
const NO_STORE_PATHS = [
  "/consent",
  "/intake",
  "/task",
  "/post",
  "/end",
];

const nextConfig: NextConfig = {
  // Hide the Next.js dev-mode indicator (the floating "N" in the bottom-left
  // during `next dev`). It only shows in development but participants running
  // a local preview shouldn't see it — and it also collides visually with our
  // ThemeToggle during development.
  devIndicators: false,

  async headers() {
    return NO_STORE_PATHS.map((source) => ({
      source,
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, no-cache, must-revalidate, max-age=0",
        },
      ],
    }));
  },
};

export default nextConfig;
