'use client';

import { useEffect, useRef } from 'react';
import { syncService } from '@/services/sync.service';
import { onlineStatusService } from '@/services/onlineStatusService';
import { useAuthStore } from '@/stores/authStore';

const SYNC_INTERVAL = 30000; // 30 seconds

export function useSync() {
  const isSyncingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { business } = useAuthStore(); // Use authStore as source of truth for session

  const triggerSync = async () => {
    if (isSyncingRef.current || !onlineStatusService.getOnlineStatus()) return;
    
    isSyncingRef.current = true;
    try {
      console.log('[useSync] Starting sync cycle...');
      await syncService.processQueue();
      if (business?.id) {
        await syncService.pullFromCloud(business.id);
      }
      console.log('[useSync] Sync cycle completed.');
    } catch (error) {
      console.error('[useSync] Sync error:', error);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!business) return;

    // Initial sync
    triggerSync();

    // Set up interval
    timerRef.current = setInterval(triggerSync, SYNC_INTERVAL);

    // Subscribe to online status for IMMEDIATE sync on return
    const unsubscribe = onlineStatusService.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[useSync] Connection restored, triggering immediate sync...');
        triggerSync();
      }
    });

    // Also listen to window events for extra reliability
    window.addEventListener('online', triggerSync);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubscribe();
      window.removeEventListener('online', triggerSync);
    };
  }, [business?.id]);

  return {
    triggerSync,
  };
}
