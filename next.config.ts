import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: ['*'], // Allow testing from mobile devices on the network
  },
};

export default nextConfig;
