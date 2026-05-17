// src/lib/runtime-mode.ts
// Detects whether the app is running as an installed PWA or in a regular browser tab.
// This is the single source of truth for all mode-based storage key generation.

export type RuntimeMode = 'pwa' | 'browser';

// Module-level cache — stable for the lifetime of this JS context
let cachedMode: RuntimeMode | null = null;

const RUNTIME_MODE_KEY = 'kola-runtime-mode';

/**
 * Detects the current runtime mode.
 *
 * PWA mode if ANY of these are true:
 *  1. localStorage marker 'kola-runtime-mode' === 'pwa' (persisted from prior detection)
 *  2. display-mode: standalone (installed PWA)
 *  3. display-mode: fullscreen
 *  4. document.referrer starts with android-app://
 *  5. iOS navigator.standalone
 *  6. URL has ?source=pwa
 *
 * IMPORTANT: Uses localStorage (NOT sessionStorage) so the marker persists
 * after the PWA is closed and reopened. sessionStorage clears on close.
 *
 * SSR-safe: returns 'browser' on the server.
 */
export function getRuntimeMode(): RuntimeMode {
  if (typeof window === 'undefined') return 'browser';

  // Return cached result for consistency within this JS context
  if (cachedMode) return cachedMode;

  // 1. Check persistent localStorage marker FIRST (survives PWA close/reopen)
  const persistedMarker = window.localStorage.getItem(RUNTIME_MODE_KEY);
  if (persistedMarker === 'pwa') {
    cachedMode = 'pwa';
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RuntimeMode] Detected PWA from localStorage marker');
    }
    return cachedMode;
  }

  // 2. Check live signals
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isAndroidTWA = document.referrer.startsWith('android-app://');
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isPwaSource = new URLSearchParams(window.location.search).get('source') === 'pwa';

  const isPwa = isStandalone || isFullscreen || isAndroidTWA || isIOSStandalone || isPwaSource;

  if (isPwa) {
    cachedMode = 'pwa';
    // Persist to localStorage so it survives PWA close/reopen
    window.localStorage.setItem(RUNTIME_MODE_KEY, 'pwa');
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RuntimeMode] Detected PWA from live signals:', {
        isStandalone, isFullscreen, isAndroidTWA, isIOSStandalone, isPwaSource
      });
    }
  } else {
    cachedMode = 'browser';
    // Only persist 'browser' if no marker exists yet (never overwrite 'pwa' with 'browser')
    if (!persistedMarker) {
      window.localStorage.setItem(RUNTIME_MODE_KEY, 'browser');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[RuntimeMode] Detected browser mode');
    }
  }

  return cachedMode;
}

/**
 * Force-clears the runtime mode marker. Called only during explicit logout
 * from PWA mode so the next launch shows the login screen.
 */
export function clearRuntimeModeMarker() {
  if (typeof window === 'undefined') return;
  cachedMode = null;
  window.localStorage.removeItem(RUNTIME_MODE_KEY);
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
