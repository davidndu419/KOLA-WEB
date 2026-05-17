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
  const runningRef = useRef(false);

  const triggerSync = async () => {
    const businessId = business?.id || business?.business_id;
    if (!businessId) return;
    if (!onlineStatusService.getOnlineStatus()) {
      await syncService.recoverStaleSyncState(businessId);
      wasOfflineRef.current = true;
      return;
    }
    if (runningRef.current) return;

    try {
      runningRef.current = true;
      const success = await syncService.runFullSync(businessId);
      if (success && wasOfflineRef.current && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Changes synced successfully' } }));
      }
    } catch (error) {
      console.error('[useSync] Sync error:', error);
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    const businessId = business?.id || business?.business_id;
    if (!businessId) return;

    syncService.recoverStaleSyncState(businessId).catch((error) => {
      console.warn('[useSync] Stale sync recovery failed:', error);
    });

    if (onlineStatusService.getOnlineStatus()) {
      triggerSync();
    } else {
      wasOfflineRef.current = true;
    }

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
    window.addEventListener('online', triggerSync);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubscribe();
      window.removeEventListener('online', triggerSync);
    };
  }, [business?.id, business?.business_id]);

  return {
    triggerSync,
  };
}
