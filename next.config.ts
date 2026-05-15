// @ts-ignore
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /^\/(_next\/static|static|logo|icons|fonts)\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
      },
    },
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dynamic-content',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 24 hours
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
  fallbacks: {
    document: '/dashboard', 
    image: '',
    audio: '',
    video: '',
    font: '',
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Give 'config' the 'any' type to satisfy the compiler
  webpack: (config: any) => {
    return config;
  },
};

export default withPWA(nextConfig);