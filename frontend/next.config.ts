import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");

const config: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default config;
