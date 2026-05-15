'use client';

import { useEffect } from 'react';

export function PWARegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      let refreshing = false;
      const handleControllerChange = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(async (registration) => {
          console.log('[PWA] SW registered', registration);
          console.log('[PWA] SW controlling page', !!navigator.serviceWorker.controller);
          await registration.update();

          const readyRegistration = await navigator.serviceWorker.ready;
          console.log('[PWA] SW ready with scope', readyRegistration.scope);

          let dashboardCached = await caches.match('/dashboard');
          let offlineFallbackCached = await caches.match('/_offline');

          if (navigator.onLine && (!dashboardCached || !offlineFallbackCached)) {
            const appShellCache = await caches.open('kola-app-shell');
            await appShellCache.addAll(['/dashboard', '/_offline', '/manifest.json']);
            dashboardCached = await caches.match('/dashboard');
            offlineFallbackCached = await caches.match('/_offline');
          }

          console.log('[PWA] dashboard cached', !!dashboardCached);
          console.log('[PWA] offline fallback registered', !!offlineFallbackCached);
        })
        .catch((registrationError) => {
          console.log('[PWA] SW registration failed', registrationError);
        });

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  return null;
}
