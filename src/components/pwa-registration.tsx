'use client';

import { useEffect } from 'react';

export const KOLA_APP_BUILD_VERSION = 'kola-offline-stability-v1';

export function PWARegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      (window as any).__KOLA_APP_BUILD_VERSION__ = KOLA_APP_BUILD_VERSION;

      let refreshing = false;
      const handleControllerChange = () => {
        if (refreshing) return;
        if (window.sessionStorage.getItem('kola-sw-reloaded-once') === KOLA_APP_BUILD_VERSION) return;
        refreshing = true;
        window.sessionStorage.setItem('kola-sw-reloaded-once', KOLA_APP_BUILD_VERSION);
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(async (registration) => {
          console.log('[PWA] SW registered', registration);
          console.log('[PWA] SW active:', !!registration.active);
          console.log('[PWA] SW controlling page:', !!navigator.serviceWorker.controller);
          
          await registration.update();

          // Define utility for manual caching
          (window as any).cacheEssentialAppShell = async () => {
            console.log('[PWA] Manually caching essential app shell...');
            const cache = await caches.open('kola-app-shell');
            const routesToCache = [
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
              '/offline',
              '/manifest.json'
            ];
            
            const results: Record<string, { success: boolean; status?: number; error?: string }> = {};

            for (const route of routesToCache) {
              try {
                const response = await fetch(route, { 
                  cache: 'reload', 
                  credentials: 'same-origin' 
                });
                
                if (response.ok) {
                  await cache.put(route, response.clone());
                  results[route] = { success: true, status: response.status };
                  console.log(`[PWA] Cached: ${route}`);
                } else {
                  results[route] = { success: false, status: response.status };
                  console.warn(`[PWA] Failed to cache ${route}: ${response.status} ${response.statusText}`);
                }
              } catch (err: any) {
                results[route] = { success: false, error: err.message };
                console.error(`[PWA] Error caching ${route}:`, err);
              }
            }

            return results;
          };

          const readyRegistration = await navigator.serviceWorker.ready;
          console.log('[PWA] SW ready with scope', readyRegistration.scope);

          const storedVersion = window.localStorage.getItem('kola-app-build-version');
          if (storedVersion && storedVersion !== KOLA_APP_BUILD_VERSION) {
            console.log('[PWA] App version changed, refreshing caches:', storedVersion, '->', KOLA_APP_BUILD_VERSION);
            window.localStorage.setItem('kola-app-build-version', KOLA_APP_BUILD_VERSION);
            if (window.sessionStorage.getItem('kola-version-reloaded-once') !== KOLA_APP_BUILD_VERSION) {
              window.sessionStorage.setItem('kola-version-reloaded-once', KOLA_APP_BUILD_VERSION);
              window.location.reload();
              return;
            }
          } else {
            window.localStorage.setItem('kola-app-build-version', KOLA_APP_BUILD_VERSION);
          }

          // Auto-cache on registration if online
          if (navigator.onLine) {
            await (window as any).cacheEssentialAppShell();
          }

          let dashboardCached = await caches.match('/dashboard');
          console.log('[PWA] dashboard in cache:', !!dashboardCached);
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
