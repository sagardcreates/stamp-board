import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ don't fail Vercel build on lint errors
  },
  /* other config options can stay here */
};

export default nextConfig;
