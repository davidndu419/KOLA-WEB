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

    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: fullscreen)').matches;

    setMode(isStandalone ? 'standalone' : 'browser');

    if (isStandalone) {
      setStatus('installed');
    } else if (deferredPrompt) {
      setStatus('can-install');
    } else {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
      setStatus(isMobile ? 'manual-install' : 'browser');
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
      checkStatus();
    };

    const handleDisplayModeChange = () => checkStatus();
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery.addEventListener?.('change', handleDisplayModeChange);

    // Periodic check for display mode changes (e.g. user manually installs)
    checkStatus();
    const interval = setInterval(checkStatus, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery.removeEventListener?.('change', handleDisplayModeChange);
      clearInterval(interval);
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
