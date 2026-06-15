import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sql.js"],
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [{ source: "/ops/lifecycles", destination: "/ops/records" }];
  },
};

export default nextConfig;
