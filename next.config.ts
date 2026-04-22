import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js dev-mode indicator (the floating "N" in the bottom-left
  // during `next dev`). It only shows in development but participants running
  // a local preview shouldn't see it — and it also collides visually with our
  // ThemeToggle during development.
  devIndicators: false,
};

export default nextConfig;
