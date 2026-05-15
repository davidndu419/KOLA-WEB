'use client';

import { useState, useEffect, useCallback } from 'react';

export type PWAInstallStatus = 'installed' | 'can-install' | 'manual-install' | 'loading';

export function usePWAInstall() {
  const [status, setStatus] = useState<PWAInstallStatus>('loading');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const checkStatus = useCallback(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: fullscreen)').matches;

    if (isStandalone) {
      setStatus('installed');
    } else if (deferredPrompt) {
      setStatus('can-install');
    } else {
      setStatus('manual-install');
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
      setStatus('installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Periodic check for display mode changes (e.g. user manually installs)
    checkStatus();
    const interval = setInterval(checkStatus, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(interval);
    };
  }, [checkStatus]);

  const installApp = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setStatus('installed');
      return true;
    }
    
    return false;
  };

  return {
    status,
    isInstalled: status === 'installed',
    canInstall: status === 'can-install',
    installApp,
    deferredPrompt
  };
}
