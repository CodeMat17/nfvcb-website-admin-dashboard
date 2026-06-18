import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fastidious-flamingo-212.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "fastidious-flamingo-212.convex.site",
      },
    ],
  },
};

export default nextConfig;
