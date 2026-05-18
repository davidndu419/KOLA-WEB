'use client';

import { useEffect, useRef } from 'react';
import { syncService } from '@/services/sync.service';
import { onlineStatusService } from '@/services/onlineStatusService';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const SYNC_INTERVAL = 45000;
const REALTIME_DEBOUNCE_MS = 350;

const REALTIME_TABLES = [
  'transactions',
  'sales',
  'sale_items',
  'services',
  'expenses',
  'products',
  'inventory_movements',
  'ledger_entries',
  'service_categories',
  'expense_categories',
  'receivables',
  'receipts',
  'app_settings',
];

export function useSync() {
  const business = useAuthStore((state) => state.business);
  const user = useAuthStore((state) => state.user);
  const activeBusinessId = useAuthStore((state) => state.activeBusinessId);
  const hydrationStatus = useAuthStore((state) => state.initialHydrationStatus);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef(false);
  const runningRef = useRef(false);
  const realtimePullRequestedRef = useRef(false);

  const triggerSync = async (allowHidden = false) => {
    const businessId = activeBusinessId || business?.id || business?.business_id;
    if (!businessId) return;
    if (!allowHidden && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!onlineStatusService.getOnlineStatus()) {
      await syncService.recoverStaleSyncState(businessId);
      wasOfflineRef.current = true;
      return;
    }
    if (runningRef.current) {
      syncService.requestImmediateSync(businessId);
      return;
    }

    try {
      runningRef.current = true;
      const success = await syncService.runFullSync(businessId);
      if (success && wasOfflineRef.current && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Changes synced successfully' } }));
        wasOfflineRef.current = false;
      }
    } catch (error) {
      console.error('[useSync] Sync error:', error);
    } finally {
      runningRef.current = false;
    }
  };

  const triggerRealtimePull = async () => {
    const businessId = activeBusinessId || business?.id || business?.business_id;
    if (!businessId) return;
    if (!onlineStatusService.getOnlineStatus()) return;
    if (runningRef.current) {
      realtimePullRequestedRef.current = true;
      return;
    }

    try {
      runningRef.current = true;
      const pulled = await syncService.pullLatestFromCloud(businessId);
      if (!pulled && (syncService.isProcessing || syncService.isFullSyncing)) {
        realtimePullRequestedRef.current = true;
      }
    } catch (error) {
      console.warn('[useSync] Realtime pull failed:', error);
    } finally {
      runningRef.current = false;
      if (realtimePullRequestedRef.current) {
        realtimePullRequestedRef.current = false;
        if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = setTimeout(triggerRealtimePull, REALTIME_DEBOUNCE_MS);
      }
    }
  };

  useEffect(() => {
    const businessId = activeBusinessId || business?.id || business?.business_id;
    if (!user?.id || !businessId || hydrationStatus !== 'complete') return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const startSyncLifecycle = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session?.user) return;

      syncService.recoverStaleSyncState(businessId).catch((error) => {
        console.warn('[useSync] Stale sync recovery failed:', error);
      });

      if (onlineStatusService.getOnlineStatus()) {
        triggerSync(true);
      } else {
        wasOfflineRef.current = true;
      }

      // Set up interval
      timerRef.current = setInterval(() => triggerSync(false), SYNC_INTERVAL);

      // Subscribe to online status
      unsubscribe = onlineStatusService.subscribe((isOnline) => {
        if (isOnline) {
          console.log('[useSync] Connection restored, triggering sync...');
          triggerSync(true);
        } else {
          wasOfflineRef.current = true;
        }
      });
      const handleOnline = () => triggerSync(true);
      const handleFocus = () => triggerSync(true);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && onlineStatusService.getOnlineStatus()) {
          triggerSync(true);
        }
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibility);

      channel = supabase.channel(`kola-sync-${businessId}`);
      REALTIME_TABLES.forEach((table) => {
        channel?.on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table,
            filter: `business_id=eq.${businessId}`,
          },
          () => {
            syncService.updateMetadata(businessId, 'last_realtime_event_at', new Date().toISOString()).catch(() => {});
            if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
            realtimeTimerRef.current = setTimeout(triggerRealtimePull, REALTIME_DEBOUNCE_MS);
          },
        );
      });

      channel.subscribe((status) => {
        syncService.updateMetadata(businessId, 'realtime_status', status).catch(() => {});
      });

      cleanupListeners = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    };

    let cleanupListeners = () => {};
    startSyncLifecycle();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      unsubscribe?.();
      cleanupListeners();
      if (channel) supabase.removeChannel(channel);
    };
  }, [business?.id, business?.business_id, activeBusinessId, user?.id, hydrationStatus]);

  return {
    triggerSync,
  };
}
