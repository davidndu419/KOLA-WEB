importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);

  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Background Sync for Supabase
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('supabase-sync', {
    maxRetentionTime: 24 * 60, // Retry for max 24 Hours
  });

  workbox.routing.registerRoute(
    ({ url }) => url.href.includes('supabase.co'),
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'POST'
  );

  // Asset caching
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'assets',
    })
  );

  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'images',
    })
  );
} else {
  console.log(`Workbox didn't load`);
}
