'use client';

import { useEffect } from 'react';
import { getStorageKeys, getRuntimeMode } from '@/lib/runtime-mode';

export const KOLA_APP_BUILD_VERSION = 'kola-offline-stability-v4';

function isChunkLoadFailure(reason: unknown) {
  const target = reason instanceof Event ? reason.target as HTMLElement | null : null;
  const targetUrl = target && 'src' in target ? String((target as HTMLScriptElement).src || '') : '';
  const value = reason instanceof PromiseRejectionEvent ? reason.reason : reason;
  const name = value && typeof value === 'object' && 'name' in value ? String((value as { name?: unknown }).name) : '';
  const message = value && typeof value === 'object' && 'message' in value
    ? String((value as { message?: unknown }).message)
    : String(value || '');

  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk \d+ failed|Loading CSS chunk \d+ failed|failed to fetch dynamically imported module|Importing a module script failed/i.test(message) ||
    /\/_next\/static\/chunks\//.test(targetUrl)
  );
}

export function PWARegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      (window as any).__KOLA_APP_BUILD_VERSION__ = KOLA_APP_BUILD_VERSION;
      const keys = getStorageKeys();
      const mode = getRuntimeMode();
      console.log(`[PWA] Runtime mode: ${mode}`);
      const chunkReloadKey = `${keys.appBuildVersion}:chunk-reload:${KOLA_APP_BUILD_VERSION}`;

      const recoverFromChunkLoadFailure = async (reason: unknown) => {
        if (!isChunkLoadFailure(reason)) return;
        if (window.sessionStorage.getItem(chunkReloadKey) === '1') return;

        window.sessionStorage.setItem(chunkReloadKey, '1');
        console.warn('[PWA] Chunk load failed, refreshing app shell once.', reason);

        if ('caches' in window) {
          await Promise.all([
            caches.delete('kola-app-shell'),
            caches.delete('kola-navigation'),
            caches.delete('kola-static-assets'),
            caches.delete('static-js-assets'),
            caches.delete('static-style-assets'),
            caches.delete('next-data'),
            caches.delete('others'),
          ]);
        }

        const registration = await navigator.serviceWorker.getRegistration('/');
        await registration?.update();
        window.location.reload();
      };

      const handleWindowError = (event: ErrorEvent) => {
        void recoverFromChunkLoadFailure(event);
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        void recoverFromChunkLoadFailure(event);
      };

      window.addEventListener('error', handleWindowError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      let refreshing = false;
      const handleControllerChange = () => {
        if (refreshing) return;
        if (window.sessionStorage.getItem(keys.swReloadedOnce) === KOLA_APP_BUILD_VERSION) return;
        refreshing = true;
        window.sessionStorage.setItem(keys.swReloadedOnce, KOLA_APP_BUILD_VERSION);
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

          const storedVersion = window.localStorage.getItem(keys.appBuildVersion);
          if (storedVersion && storedVersion !== KOLA_APP_BUILD_VERSION) {
            console.log('[PWA] App version changed, refreshing caches:', storedVersion, '->', KOLA_APP_BUILD_VERSION);
            window.localStorage.setItem(keys.appBuildVersion, KOLA_APP_BUILD_VERSION);
            if (window.sessionStorage.getItem(keys.versionReloadedOnce) !== KOLA_APP_BUILD_VERSION) {
              window.sessionStorage.setItem(keys.versionReloadedOnce, KOLA_APP_BUILD_VERSION);
              window.location.reload();
              return;
            }
          } else {
            window.localStorage.setItem(keys.appBuildVersion, KOLA_APP_BUILD_VERSION);
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
        window.removeEventListener('error', handleWindowError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, []);

  return null;
}
