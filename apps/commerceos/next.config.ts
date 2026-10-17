import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@commerceos/contracts", "@commerceos/inference"],
};

export default nextConfig;
