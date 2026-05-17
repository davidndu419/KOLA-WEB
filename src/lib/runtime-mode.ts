// src/lib/runtime-mode.ts
// Detects whether the app is running as an installed PWA or in a regular browser tab.
// This is the single source of truth for all mode-based storage key generation.

export type RuntimeMode = 'pwa' | 'browser';

let cachedMode: RuntimeMode | null = null;

/**
 * Detects the current runtime mode.
 * PWA mode if:
 *  - display-mode: standalone
 *  - display-mode: fullscreen
 *  - document.referrer starts with android-app://
 *  - URL has ?source=pwa
 *  - localStorage has the pwa mode marker from a previous detection
 *
 * SSR-safe: returns 'browser' on the server.
 */
export function getRuntimeMode(): RuntimeMode {
  if (typeof window === 'undefined') return 'browser';

  // Return cached result for consistency within a session
  if (cachedMode) return cachedMode;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isAndroidTWA = document.referrer.startsWith('android-app://');
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isPwaSource = new URLSearchParams(window.location.search).get('source') === 'pwa';

  // Check if this session was already marked as PWA (persists across navigations within session)
  const sessionMarker = window.sessionStorage.getItem('kola-runtime-mode');

  if (isStandalone || isFullscreen || isAndroidTWA || isIOSStandalone || isPwaSource || sessionMarker === 'pwa') {
    cachedMode = 'pwa';
    // Persist in sessionStorage so subsequent page navigations within the same PWA window remain consistent
    window.sessionStorage.setItem('kola-runtime-mode', 'pwa');
  } else {
    cachedMode = 'browser';
    window.sessionStorage.setItem('kola-runtime-mode', 'browser');
  }

  return cachedMode;
}

/**
 * Returns mode-prefixed storage key names.
 * All localStorage/sessionStorage keys that need isolation should be generated through this.
 */
export function getStorageKeys() {
  const mode = getRuntimeMode();
  const prefix = `kola-${mode}`;

  return {
    authStorage: `${prefix}-auth-storage`,
    appStorage: `${prefix}-app-storage`,
    supabaseAuth: `${prefix}-supabase-auth`,
    syncLock: `${prefix}-sync-lock`,
    syncInstanceId: `${prefix}-sync-instance-id`,
    appBuildVersion: `${prefix}-app-build-version`,
    swReloadedOnce: `${prefix}-sw-reloaded-once`,
    versionReloadedOnce: `${prefix}-version-reloaded-once`,
    dbVersionChangeAt: `${prefix}-db-versionchange-at`,
    pwaInstalled: 'kola-pwa-installed', // Shared: not mode-specific
  } as const;
}

/**
 * Returns the mode-specific Dexie database name.
 */
export function getDexieDbName(): string {
  const mode = getRuntimeMode();
  return mode === 'pwa' ? 'KolaDB_PWA' : 'KolaDB_Browser';
}
