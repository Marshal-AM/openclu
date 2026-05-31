import path from "node:path";
import type { NextConfig } from "next";

const dbSrc = path.join(__dirname, "../skill-capture/db/src");

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: [],
  turbopack: {
    resolveAlias: {
      "@openclu/db": dbSrc,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@openclu/db": dbSrc,
    };
    return config;
  },
};

export default nextConfig;
