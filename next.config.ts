// @ts-ignore
import withPWAInit from 'next-pwa';
// @ts-ignore
import defaultRuntimeCaching from 'next-pwa/cache';

const appShellRoutes = [
  '/',
  '/dashboard',
  '/inventory',
  '/sales',
  '/service',
  '/expenses',
  '/reports',
  '/reports/transactions',
  '/settings',
  '/auth/login',
  '/auth/register',
  '/auth/business-setup',
  '/auth/forgot-password',
  '/_offline',
];

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  reloadOnOnline: false,
  cacheOnFrontEndNav: true,
  dynamicStartUrl: true,
  dynamicStartUrlRedirect: '/dashboard',
  fallbacks: {
    document: '/_offline',
    image: '',
    audio: '',
    video: '',
    font: '',
  },
  additionalManifestEntries: appShellRoutes.map((url) => ({
    url,
    revision: 'kola-app-shell-v1',
  })),
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) => {
        const pathname = url.pathname;

        return (
          request.mode === 'navigate' &&
          url.origin === self.location.origin &&
          (pathname === '/' ||
            pathname === '/dashboard' ||
            pathname === '/inventory' ||
            pathname === '/sales' ||
            pathname === '/service' ||
            pathname === '/expenses' ||
            pathname === '/reports' ||
            pathname === '/reports/transactions' ||
            pathname === '/settings' ||
            pathname === '/auth/login' ||
            pathname === '/auth/register' ||
            pathname === '/auth/business-setup' ||
            pathname === '/auth/forgot-password' ||
            pathname === '/_offline')
        );
      },
      handler: 'CacheFirst',
      options: {
        cacheName: 'kola-app-shell',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        precacheFallback: {
          fallbackURL: '/_offline',
        },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        request.mode === 'navigate' && url.origin === self.location.origin,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'kola-app-shell',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        precacheFallback: {
          fallbackURL: '/_offline',
        },
      },
    },
    ...defaultRuntimeCaching,
  ],
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
