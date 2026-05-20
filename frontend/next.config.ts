import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: ["@arkiv-network/sdk"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@skill-capture": path.resolve(__dirname, "../skill-capture"),
    };
    return config;
  },
};

export default nextConfig;
