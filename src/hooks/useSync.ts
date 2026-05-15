'use client';

import { useEffect, useRef } from 'react';
import { syncService } from '@/services/sync.service';
import { onlineStatusService } from '@/services/onlineStatusService';
import { useAuthStore } from '@/stores/authStore';

const SYNC_INTERVAL = 30000; // 30 seconds

export function useSync() {
  const business = useAuthStore((state) => state.business);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef(false);

  const triggerSync = async () => {
    if (!business?.id) return;

    try {
      const success = await syncService.runFullSync(business.id);
      if (success && wasOfflineRef.current && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Changes synced successfully' } }));
      }
    } catch (error) {
      console.error('[useSync] Sync error:', error);
    }
  };

  useEffect(() => {
    if (!business?.id) return;

    // Initial sync
    triggerSync();

    // Set up interval
    timerRef.current = setInterval(triggerSync, SYNC_INTERVAL);

    // Subscribe to online status
    const unsubscribe = onlineStatusService.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[useSync] Connection restored, triggering sync...');
        triggerSync();
      } else {
        wasOfflineRef.current = true;
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubscribe();
    };
  }, [business?.id]);

  return {
    triggerSync,
  };
}
