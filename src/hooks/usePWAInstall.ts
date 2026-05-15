'use client';

import { useState, useEffect, useCallback } from 'react';

export type PWAInstallStatus = 'installed' | 'can-install' | 'manual-install' | 'browser' | 'loading';
export type PWADisplayMode = 'standalone' | 'browser';

export function usePWAInstall() {
  const [status, setStatus] = useState<PWAInstallStatus>('loading');
  const [mode, setMode] = useState<PWADisplayMode>('browser');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const checkStatus = useCallback(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    const isAndroidTrustedWebActivity = document.referrer.startsWith('android-app://');
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isPwaSource = new URLSearchParams(window.location.search).get('source') === 'pwa';
    const isInstalledContext = isStandalone || isFullscreen || isAndroidTrustedWebActivity || isIOSStandalone || isPwaSource;
    const wasInstalled = localStorage.getItem('kola-pwa-installed') === 'true';

    setMode(isInstalledContext ? 'standalone' : 'browser');

    if (isInstalledContext) {
      setStatus('installed');
    } else if (deferredPrompt) {
      setStatus('can-install');
    } else {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
      setStatus(isMobile && !wasInstalled ? 'manual-install' : 'browser');
    }
  }, [deferredPrompt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setStatus('can-install');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      localStorage.setItem('kola-pwa-installed', 'true');
      checkStatus();
    };

    const handleDisplayModeChange = () => checkStatus();
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkStatus();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('focus', checkStatus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    standaloneQuery.addEventListener?.('change', handleDisplayModeChange);
    fullscreenQuery.addEventListener?.('change', handleDisplayModeChange);

    checkStatus();
    const delayedCheck = setTimeout(checkStatus, 500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', checkStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      standaloneQuery.removeEventListener?.('change', handleDisplayModeChange);
      fullscreenQuery.removeEventListener?.('change', handleDisplayModeChange);
      clearTimeout(delayedCheck);
    };
  }, [checkStatus]);

  const installApp = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      checkStatus();
      return true;
    }
    
    return false;
  };

  return {
    status,
    mode,
    isInstalled: status === 'installed',
    isBrowserMode: mode === 'browser',
    canInstall: status === 'can-install',
    installApp,
    deferredPrompt
  };
}
