/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision: string | null;
  }>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST || []);

// Force all Supabase requests to go directly to network
registerRoute(
  ({ url }) => url.href.includes('supabase.co'),
  new NetworkOnly()
);

const appShellRoutes = [
  "/",
  "/dashboard",
  "/inventory",
  "/sales",
  "/service",
  "/expenses",
  "/reports",
  "/reports/transactions",
  "/settings",
  "/settings/sync",
  "/auth/login",
  "/auth/register",
  "/auth/business-setup",
  "/auth/forgot-password",
  "/offline",
];

registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    url.origin === self.location.origin &&
    appShellRoutes.includes(url.pathname) &&
    !url.href.includes('supabase.co'),
  new CacheFirst({
    cacheName: "kola-app-shell",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "kola-navigation",
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "worker",
  new StaleWhileRevalidate({
    cacheName: "kola-static-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "kola-images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

self.addEventListener("install", () => {
  console.log("[Kola SW] Installed");
});

self.addEventListener("activate", (event) => {
  console.log("[Kola SW] Activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";
  const url = new URL(targetUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of clientList) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client && client.url !== url) {
          await client.navigate(url);
        }
        return;
      }
    }

    await self.clients.openWindow(url);
  })());
});
