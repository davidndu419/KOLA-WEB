// @ts-ignore
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Give 'config' the 'any' type to satisfy the compiler
  webpack: (config: any) => {
    return config;
  },
};

export default withPWA(nextConfig);