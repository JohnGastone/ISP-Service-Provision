import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build run alongside `npm run dev` without the two
  // fighting over the same output directory (set NEXT_DIST_DIR to override).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
