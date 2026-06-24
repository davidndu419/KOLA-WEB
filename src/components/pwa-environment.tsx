'use client';

import { useEffect } from 'react';

function detectIOS() {
  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  const hasTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return /iPad|iPhone|iPod/.test(userAgent) || hasTouchMac;
}

function detectStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PWAEnvironment() {
  useEffect(() => {
    const root = document.documentElement;
    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');

    const updateClasses = () => {
      root.classList.toggle('ios-device', detectIOS());
      root.classList.toggle('pwa-standalone', detectStandalone());
    };

    updateClasses();
    standaloneQuery?.addEventListener?.('change', updateClasses);

    return () => {
      standaloneQuery?.removeEventListener?.('change', updateClasses);
    };
  }, []);

  return null;
}
