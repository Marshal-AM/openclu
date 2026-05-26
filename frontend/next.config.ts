import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle Arkiv into server chunks — externalizing breaks Vercel (missing hashed dist/*.js).
  transpilePackages: ["@arkiv-network/sdk"],
};

export default nextConfig;
