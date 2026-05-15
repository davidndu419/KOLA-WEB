'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Database, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Trash2,
  Info
} from 'lucide-react';
import { Touchable } from '@/components/touchable';
import { db } from '@/db/dexie';
import { useAuthStore } from '@/stores/authStore';
import { syncService } from '@/services/sync.service';
import { onlineStatusService } from '@/services/onlineStatusService';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(onlineStatusService.getOnlineStatus());

  useEffect(() => {
    const unsubscribe = onlineStatusService.subscribe(setIsOnline);
    return () => {
      unsubscribe();
    };
  }, []);

  return isOnline;
}

function latestSettingValue(settings: { key: string; value: any; updated_at: Date }[], key: string) {
  return settings
    .filter((setting) => setting.key === key)
    .sort((a, b) => {
      const left = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const right = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return right - left;
    })[0]?.value;
}

export default function SyncSettingsPage() {
  const router = useRouter();
  const business = useAuthStore((state) => state.business);
  const isOnline = useOnlineStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const businessId = business?.id;

  const metadata = useLiveQuery(async () => {
    if (!businessId) return null;
    const settings = await db.app_settings.where('business_id').equals(businessId).toArray();
    return {
      lastSuccess: latestSettingValue(settings, 'last_successful_sync_at'),
      lastAttempt: latestSettingValue(settings, 'last_sync_attempt_at'),
      status: latestSettingValue(settings, 'last_sync_status'),
      error: latestSettingValue(settings, 'last_sync_error'),
    };
  }, [businessId]);

  const diagnostics = useLiveQuery(
    () => businessId ? syncService.getQueueDiagnostics(businessId) : Promise.resolve(null),
    [businessId, syncTick]
  );
  
  const pendingCount = diagnostics?.pendingCount || 0;
  const failedCount = diagnostics?.failedCount || 0;
  const firstProblem = diagnostics?.firstProblem;

  const handleForceSync = async () => {
    if (!isOnline || !businessId) return;
    setIsManualSyncing(true);
    setSyncMessage(null);
    try {
      const success = await syncService.runFullSync(businessId);
      setSyncTick((value) => value + 1);

      if (success) {
        window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Changes synced successfully' } }));
        setSyncMessage('Changes synced successfully');
      } else {
        const latestDiagnostics = await syncService.getQueueDiagnostics(businessId);
        const item = latestDiagnostics.firstProblem;
        const detail = item
          ? `${item.entity} ${item.action} is ${item.status}${item.error ? `: ${item.error}` : ''}`
          : 'Pending or failed changes remain in the local queue';
        setSyncMessage(detail);
        window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Sync needs attention' } }));
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.message || 'Sync failed';
      setSyncMessage(message);
      window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message } }));
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!businessId) return;
    await syncService.retryFailed(businessId);
    setSyncMessage('Failed sync items moved back to pending');
    setSyncTick((value) => value + 1);
  };

  const handleClearFailedItem = async (id?: number) => {
    if (!id) return;
    if (!confirm('Clear this failed sync item? Local data will stay on this device, but this queued cloud sync attempt will be removed.')) return;
    await syncService.clearFailedItem(id);
    setSyncMessage('Failed sync item cleared');
    setSyncTick((value) => value + 1);
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'Never';
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Never';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-4 px-4 h-16 glassmorphism border-b border-border/40 safe-area-pt">
        <Touchable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <ChevronLeft size={24} />
        </Touchable>
        <h1 className="text-xl font-bold tracking-tight">Sync Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32">
        {/* Connection Status Card */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className={cn(
              "p-2 rounded-xl",
              isOnline ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600"
            )}>
              {isOnline ? <Cloud size={20} /> : <CloudOff size={20} />}
            </div>
            <div>
              <h2 className="text-sm font-bold">Cloud Connection</h2>
              <p className={cn("text-[10px] font-black uppercase tracking-widest", isOnline ? "text-emerald-500" : "text-slate-500")}>
                {isOnline ? 'Online • Ready to sync' : 'Offline • Saving locally'}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-[32px] p-6 space-y-5 border border-border/40 shadow-sm">
            <StatusRow 
              label="Sync Status" 
              value={isManualSyncing ? 'Syncing...' : !isOnline ? 'Offline' : pendingCount > 0 ? 'Pending' : failedCount > 0 ? 'Failed' : metadata?.status === 'syncing' ? 'Syncing' : metadata?.lastSuccess ? 'Synced' : 'Not synced yet'} 
              color={
                isManualSyncing || metadata?.status === 'syncing' ? "text-primary animate-pulse" :
                !isOnline ? "text-slate-500" :
                failedCount > 0 || metadata?.status === 'failed' ? "text-red-500" :
                pendingCount > 0 ? "text-amber-500" : "text-emerald-500"
              }
            />
            <StatusRow label="Last Successful Sync" value={formatTime(metadata?.lastSuccess)} />
            <StatusRow label="Last Sync Attempt" value={formatTime(metadata?.lastAttempt)} />
            <StatusRow 
              label="Pending Changes" 
              value={pendingCount === 0 ? '0 pending' : `${pendingCount} waiting`} 
              color={pendingCount > 0 ? "text-amber-500" : ""}
            />
            <StatusRow 
              label="Failed Changes" 
              value={failedCount === 0 ? '0 failed' : `${failedCount} failed`} 
              color={failedCount > 0 ? "text-red-500" : ""}
            />

            {metadata?.error && (
              <div className="rounded-2xl bg-red-500/10 p-4 flex gap-3 items-start border border-red-500/20">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600 break-words leading-relaxed">
                  Last Error: {metadata.error}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Actions Section */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Manual Actions</h3>
          <div className="space-y-3">
            <Touchable 
              onPress={handleForceSync}
              disabled={!isOnline || isManualSyncing || !businessId}
              className={cn(
                "w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10",
                isOnline && !isManualSyncing ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
              )}
            >
              <RefreshCw size={18} className={cn(isManualSyncing && "animate-spin")} />
              {isManualSyncing ? 'Processing...' : 'Force Manual Sync'}
            </Touchable>

            {failedCount > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Touchable
                  onPress={handleRetryFailed}
                  className="h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <RefreshCw size={14} />
                  Retry Failed
                </Touchable>
                <Touchable
                  onPress={() => handleClearFailedItem(firstProblem?.id)}
                  className="h-12 rounded-2xl bg-red-500/10 text-red-600 border border-red-500/20 flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Trash2 size={14} />
                  Clear Failed
                </Touchable>
              </div>
            )}
          </div>
        </section>

        {/* Info Box */}
        <section className="p-5 rounded-[24px] bg-secondary/50 border border-border/40 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary border border-border/40 shadow-sm shrink-0">
            <Info size={20} />
          </div>
          <p className="text-xs font-medium text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground">Cross-device Sync:</span> Your data is saved locally first and synced to cloud when internet is available. Changes on other devices will appear once synced.
          </p>
        </section>

        {/* Diagnostic Queue */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sync Queue Diagnostics</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary rounded-full">{diagnostics?.items.length || 0} Items</span>
          </div>

          <div className="space-y-3">
            {diagnostics?.items.length ? (
              diagnostics.items.map((item) => (
                <div key={item.id || item.entity_id} className="glass-card rounded-2xl p-4 border border-border/40 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <p className="text-xs font-black capitalize tracking-tight">{item.entity}</p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                      item.status === 'failed' ? "bg-red-500/10 text-red-600" : 
                      item.status === 'pending' ? "bg-amber-500/10 text-amber-600" : 
                      "bg-emerald-500/10 text-emerald-600"
                    )}>
                      {item.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Action</p>
                      <p className="text-[11px] font-bold capitalize">{item.action}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Retries</p>
                      <p className="text-[11px] font-bold">{item.retry_count} / 5</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Created</p>
                      <p className="text-[11px] font-bold">{formatDistanceToNow(new Date(item.created_at || new Date()), { addSuffix: true })}</p>
                    </div>
                  </div>

                  {item.error && (
                    <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                      <p className="text-[10px] font-bold text-red-600 break-words leading-relaxed">{item.error}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-40">
                <CheckCircle2 size={32} />
                <p className="text-xs font-bold uppercase tracking-widest">Queue is clear</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
      <span className={cn("text-xs font-bold", color || "text-foreground")}>{value}</span>
    </div>
  );
}
