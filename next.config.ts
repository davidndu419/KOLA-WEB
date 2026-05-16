// @ts-ignore
import withPWAInit from 'next-pwa';
// @ts-ignore
import defaultRuntimeCaching from 'next-pwa/cache';

const appShellRoutes = [
  '/',
  '/dashboard',
  '/inventory',
  '/inventory/add',
  '/sales',
  '/sales/credit',
  '/service',
  '/service/credit',
  '/expenses',
  '/reports',
  '/reports/transactions',
  '/settings',
  '/settings/sync',
  '/settings/pwa-cache',
  '/settings/service-categories',
  '/settings/expense-categories',
  '/auth/login',
  '/auth/register',
  '/auth/business-setup',
  '/auth/forgot-password',
  '/offline',
];

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  reloadOnOnline: false,
  cacheOnFrontEndNav: true,
  dynamicStartUrl: false,
  fallbacks: {
    document: '/offline',
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
        const cacheFirstRoutes = [
          '/',
          '/dashboard',
          '/inventory',
          '/inventory/add',
          '/sales',
          '/sales/credit',
          '/service',
          '/service/credit',
          '/expenses',
          '/reports',
          '/reports/transactions',
          '/settings',
          '/settings/sync',
          '/settings/pwa-cache',
          '/settings/service-categories',
          '/settings/expense-categories',
          '/auth/login',
          '/auth/register',
          '/auth/business-setup',
          '/auth/forgot-password',
          '/offline',
        ];

        return (
          request.mode === 'navigate' &&
          url.origin === self.location.origin &&
          cacheFirstRoutes.includes(pathname)
        );
      },
      handler: 'CacheFirst',
      options: {
        cacheName: 'kola-app-shell',
        expiration: {
          maxEntries: 48,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        precacheFallback: {
          fallbackURL: '/offline',
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
          maxEntries: 48,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        precacheFallback: {
          fallbackURL: '/offline',
        },
      },
    },
    ...defaultRuntimeCaching,
  ],
  buildExcludes: [/middleware-manifest\.json$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: any) => {
    return config;
  },
};

export default withPWA(nextConfig);
