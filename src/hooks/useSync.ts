'use client';

import { useEffect, useRef } from 'react';
import { syncService } from '@/services/sync.service';
import { onlineStatusService } from '@/services/onlineStatusService';
import { useStore } from '@/store/use-store';

const SYNC_INTERVAL = 30000; // 30 seconds

export function useSync() {
  const { business } = useStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSync = async () => {
    try {
      await syncService.processQueue();
      if (business) {
        await syncService.pullFromCloud(business.id);
      }
    } catch (error) {
      console.error('[useSync] Sync error:', error);
    }
  };

  useEffect(() => {
    if (!business) return;

    // Initial sync
    triggerSync();

    // Set up interval
    timerRef.current = setInterval(triggerSync, SYNC_INTERVAL);

    // Subscribe to online status
    const unsubscribe = onlineStatusService.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[useSync] Connection restored, triggering sync...');
        triggerSync();
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubscribe();
    };
  }, [business]);

  return {
    triggerSync,
  };
}
