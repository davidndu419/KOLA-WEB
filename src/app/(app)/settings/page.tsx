'use client';

import { useEffect, useState } from 'react';
import { 
  User, 
  Store, 
  Bell, 
  Lock, 
  Smartphone,
  Download,
  Database, 
  Trash2, 
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Info
} from 'lucide-react';
import { Touchable } from '@/components/touchable';
import { db } from '@/db/dexie';
import { useStore } from '@/store/use-store';
import { useAuthStore } from '@/stores/authStore';
import { BottomSheet } from '@/components/bottom-sheet';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncService } from '@/services/sync.service';
import { onlineStatusService } from '@/services/onlineStatusService';
import { formatDistanceToNow } from 'date-fns';
import { authService } from '@/services/authService';

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


export default function SettingsPage() {
  const { 
    setBusiness, 
    theme, 
    setTheme, 
    notificationsEnabled, 
    setNotificationsEnabled
  } = useStore();
  const authBusiness = useAuthStore((state) => state.business);
  const authUser = useAuthStore((state) => state.user);
  const business = authBusiness
    ? {
        id: authBusiness.id,
        name: authBusiness.business_name || authBusiness.name,
        type: authBusiness.business_type || authBusiness.type,
        currency: authBusiness.currency,
        ownerName: authUser?.full_name || authUser?.email || 'Owner',
        address: '',
      }
    : null;

  const [activeSheet, setActiveSheet] = useState<'profile' | 'notifications' | 'sync' | null>(null);
  const [profileForm, setProfileForm] = useState({ name: business?.name || '', address: business?.address || '' });

  const handleClearData = async () => {
    if (confirm('Are you sure? This will delete all local data!')) {
      await db.delete();
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const handleLogout = async () => {
    if (confirm('Logout from this device?')) {
      await authService.signOut();
      window.location.href = '/';
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    // In a real app, we would apply the class to html/body
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const saveProfile = () => {
    if (business) {
      setBusiness({ ...business, name: profileForm.name, address: profileForm.address });
      setActiveSheet(null);
    }
  };

  return (
    <div className="px-6 space-y-8 pb-32">
      <header className="py-4">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground font-medium">Account & Preferences</p>
      </header>

      {/* Profile Section */}
      <section className="flex items-center gap-4 p-4 glass-card rounded-[32px]">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary border-4 border-white/5 shadow-inner">
          <User size={32} />
        </div>
        <div>
          <h3 className="font-bold text-lg">{business?.name || 'Kola Business'}</h3>
          <p className="text-xs text-muted-foreground font-medium capitalize">{business?.type || 'Business'}</p>
          <p className="text-xs text-muted-foreground font-medium">{business?.ownerName || 'Owner'} • Basic Plan</p>
        </div>
        <Touchable 
          onPress={() => setActiveSheet('profile')}
          className="ml-auto w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
        >
          <ChevronRight size={18} />
        </Touchable>
      </section>

      {/* Main Settings List */}
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4">Business & UI</h3>
          
          <SettingItem 
            icon={<Store size={18} />} 
            label="Business Profile" 
            sub="Store name, address, tax info" 
            onPress={() => setActiveSheet('profile')}
          />
          <SettingItem 
            icon={<Bell size={18} />} 
            label="Notifications" 
            sub={notificationsEnabled ? "Enabled" : "Disabled"} 
            onPress={() => setActiveSheet('notifications')}
          />
          <SettingItem 
            icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} 
            label="Appearance" 
            sub={`${theme === 'light' ? 'Light' : 'Dark'} Mode Active`} 
            onPress={toggleTheme}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4">System</h3>
          
          <PWASettingItem />
          
          <SyncSettingItem onOpenSheet={() => setActiveSheet('sync')} />
          <SettingItem 
            icon={<Trash2 size={18} className="text-red-500" />} 
            label="Clear Local Data" 
            sub="Wipe all offline database records" 
            onPress={handleClearData}
            danger
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4">Support</h3>
          <SettingItem icon={<Info size={18} />} label="About Kola" sub="Version 1.0.4 - Premium Edition" />
          
          <Touchable 
            onPress={handleLogout}
            className="w-full flex items-center gap-4 p-4 bg-red-500/5 rounded-2xl text-red-500 mt-4"
          >
            <LogOut size={18} />
            <span className="font-bold text-sm">Logout from Device</span>
          </Touchable>
        </div>
      </div>

      {/* Sheets */}
      <BottomSheet isOpen={activeSheet === 'profile'} onClose={() => setActiveSheet(null)} title="Business Profile">
        <div className="space-y-6 py-6 pb-12">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Store Name</label>
              <input 
                value={profileForm.name}
                onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Physical Address</label>
              <textarea 
                value={profileForm.address}
                onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              />
            </div>
          </div>
          <Touchable onPress={saveProfile} className="w-full bg-primary text-white p-5 rounded-2xl font-bold text-center shadow-lg shadow-primary/20">
            Save Business Info
          </Touchable>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'notifications'} onClose={() => setActiveSheet(null)} title="Notifications">
        <div className="space-y-6 py-6 pb-12">
          <div className="flex items-center justify-between p-4 glass-card rounded-2xl">
            <div>
              <p className="font-bold text-sm">Push Notifications</p>
              <p className="text-[10px] text-muted-foreground font-bold">Alerts for stock & sales</p>
            </div>
            <button 
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                notificationsEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                notificationsEnabled ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={activeSheet === 'sync'} onClose={() => setActiveSheet(null)} title="Sync Settings">
        <SyncBottomSheetContent onClose={() => setActiveSheet(null)} />
      </BottomSheet>
    </div>
  );
}

function SyncSettingItem({ onOpenSheet }: { onOpenSheet: () => void }) {
  const business = useAuthStore((state) => state.business);
  const isOnline = useOnlineStatus();
  const businessId = business?.id;
  
  const metadata = useLiveQuery(async () => {
    if (!businessId) return null;
    const settings = await db.app_settings.where('business_id').equals(businessId).toArray();
    return {
      lastSuccess: latestSettingValue(settings, 'last_successful_sync_at'),
      status: latestSettingValue(settings, 'last_sync_status'),
      error: latestSettingValue(settings, 'last_sync_error'),
    };
  }, [businessId]);

  const pendingCount = useLiveQuery(
    () => businessId
      ? db.sync_queue.where('business_id').equals(businessId).filter((item) => item.status === 'pending' || item.status === 'syncing').count()
      : Promise.resolve(0),
    [businessId]
  ) || 0;
  const failedCount = useLiveQuery(
    () => businessId
      ? db.sync_queue.where('business_id').equals(businessId).filter((item) => item.status === 'failed').count()
      : Promise.resolve(0),
    [businessId]
  ) || 0;

  const getSubtitle = () => {
    if (!isOnline) return "Offline — saved locally";
    if (pendingCount > 0) return `${pendingCount} changes pending`;
    if (failedCount > 0) return `${failedCount} changes failed`;
    if (metadata?.status === 'syncing') return "Syncing...";
    if (metadata?.lastSuccess) {
      try {
        return `Synced ${formatDistanceToNow(new Date(metadata.lastSuccess), { addSuffix: true })}`;
      } catch (e) {
        return "Synced recently";
      }
    }
    return "Not synced yet";
  };

  const getBadge = () => {
    if (!isOnline) return "Offline";
    if (pendingCount > 0) return "Pending";
    if (failedCount > 0 || metadata?.status === 'failed') return "Failed";
    if (metadata?.status === 'syncing') return "Syncing";
    if (metadata?.lastSuccess) return "Synced";
    return "Not Synced";
  };

  const getBadgeColor = () => {
    if (!isOnline) return "bg-slate-500/10 text-slate-600";
    if (pendingCount > 0) return "bg-amber-500/10 text-amber-600";
    if (failedCount > 0 || metadata?.status === 'failed') return "bg-red-500/10 text-red-600";
    if (metadata?.status === 'syncing') return "bg-primary/10 text-primary animate-pulse";
    return "bg-emerald-500/10 text-emerald-600";
  };

  return (
    <SettingItem 
      icon={<Database size={18} className={cn(!isOnline && "text-slate-400")} />} 
      label="Sync Settings" 
      sub={getSubtitle()} 
      badge={getBadge()}
      badgeColor={getBadgeColor()}
      onPress={onOpenSheet}
    />
  );
}

function SyncBottomSheetContent({ onClose }: { onClose: () => void }) {
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
      const latestDiagnostics = await syncService.getQueueDiagnostics(businessId);
      setSyncTick((value) => value + 1);

      if (success) {
        window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Changes synced successfully' } }));
        setSyncMessage('Changes synced successfully');
      } else {
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
    <div className="space-y-6 py-6 pb-12">
      <div className="text-center space-y-2 py-4">
        <Database size={48} className={cn("mx-auto transition-colors", isOnline ? "text-primary opacity-20" : "text-slate-400 opacity-20")} />
        <h4 className="font-bold">Offline Sync Engine</h4>
        <p className="text-xs text-muted-foreground font-medium px-8">All your data is stored locally and will sync when you are online.</p>
      </div>

      <div className="p-4 glass-card rounded-[24px] space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cloud Connection</p>
          <span className={cn("text-xs font-bold", isOnline ? "text-emerald-500" : "text-slate-500")}>
            {isOnline ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Last Successful Sync</p>
          <span className="text-xs font-bold">{formatTime(metadata?.lastSuccess)}</span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending Changes</p>
          <span className={cn("text-xs font-bold", pendingCount > 0 ? "text-amber-500" : "text-muted-foreground")}>
            {pendingCount === 0 ? '0 pending' : `${pendingCount} waiting to sync`}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Failed Changes</p>
          <span className={cn("text-xs font-bold", failedCount > 0 ? "text-red-500" : "text-muted-foreground")}>
            {failedCount === 0 ? '0 failed' : `${failedCount} need attention`}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</p>
          <span className={cn("text-xs font-bold capitalize",
            isManualSyncing ? "text-primary animate-pulse" :
            !isOnline ? "text-slate-500" :
            failedCount > 0 || metadata?.status === 'failed' ? "text-red-500" :
            pendingCount > 0 ? "text-amber-500" :
            metadata?.status === 'syncing' ? "text-primary animate-pulse" : "text-emerald-500")}>
            {isManualSyncing ? 'Syncing...' : !isOnline ? 'Offline' : pendingCount > 0 ? 'Pending' : failedCount > 0 ? 'Failed' : metadata?.status === 'syncing' ? 'Syncing' : metadata?.lastSuccess ? 'Synced' : 'Not synced yet'}
          </span>
        </div>
        {metadata?.error && (
          <div className="rounded-2xl bg-red-500/10 p-3 text-xs font-bold text-red-600">
            Last sync error: {metadata.error}
          </div>
        )}
        {firstProblem && (
          <div className="rounded-2xl bg-amber-500/10 p-3 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">First Queue Problem</p>
            <p className="text-xs font-bold text-foreground">{firstProblem.entity} • {firstProblem.action} • {firstProblem.status}</p>
            <p className="text-[11px] font-bold text-muted-foreground">Retry count: {firstProblem.retry_count}</p>
            <p className="text-[11px] font-medium text-muted-foreground break-words">{firstProblem.error || 'No error captured yet. Retry to capture the exact Supabase/network response.'}</p>
          </div>
        )}
        {syncMessage && (
          <div className="rounded-2xl bg-secondary p-3 text-xs font-bold text-muted-foreground break-words">
            {syncMessage}
          </div>
        )}
      </div>

      <Touchable 
        onPress={handleForceSync}
        disabled={!isOnline || isManualSyncing || !businessId}
        className={cn(
          "w-full p-5 rounded-[24px] font-bold text-center transition-all",
          isOnline && !isManualSyncing ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-secondary text-muted-foreground"
        )}
      >
        {isManualSyncing ? 'Processing...' : 'Force Manual Sync'}
      </Touchable>

      {failedCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Touchable
            onPress={handleRetryFailed}
            className="p-4 rounded-2xl bg-secondary text-primary text-center text-xs font-bold"
          >
            Retry Failed Sync
          </Touchable>
          <Touchable
            onPress={() => handleClearFailedItem(firstProblem?.status === 'failed' ? firstProblem.id : undefined)}
            className="p-4 rounded-2xl bg-red-500/10 text-red-600 text-center text-xs font-bold"
          >
            Clear Failed Item
          </Touchable>
        </div>
      )}

      <div className="p-4 glass-card rounded-[24px] space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Developer Sync Queue Debug</p>
          <p className="text-[10px] font-bold text-muted-foreground">Visible in development and test builds for stuck offline sync inspection.</p>
        </div>
        {diagnostics?.items.length ? (
          <div className="space-y-2">
            {diagnostics.items.map((item) => (
              <div key={item.id || item.entity_id} className="rounded-2xl bg-secondary/70 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black truncate">{item.entity}</p>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">{item.status}</span>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.action} • retries {item.retry_count}</p>
                {item.error && <p className="text-[10px] font-medium text-red-500 break-words">{item.error}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-muted-foreground">Queue is empty.</p>
        )}
      </div>
      
      {!isOnline && (
        <p className="text-[10px] text-center text-red-400 font-bold uppercase tracking-widest animate-pulse">
          Connection required to sync
        </p>
      )}
    </div>
  );
}

function PWASettingItem() {
  const { status, installApp } = usePWAInstall();

  if (status === 'installed') {
    return (
      <SettingItem 
        icon={<Smartphone size={18} />} 
        label="PWA Installation" 
        sub="App is currently installed" 
        badge="Installed" 
        badgeColor="bg-emerald-500/10 text-emerald-600"
      />
    );
  }

  if (status === 'can-install') {
    return (
      <SettingItem 
        icon={<Smartphone size={18} className="text-amber-500" />} 
        label="PWA Installation" 
        sub="Install Kola for app-like experience" 
        badge="Available" 
        badgeColor="bg-amber-500/10 text-amber-600"
        rightElement={
          <Touchable 
            onPress={() => installApp()}
            className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <Download size={18} />
          </Touchable>
        }
      />
    );
  }

  if (status === 'browser') {
    return (
      <SettingItem
        icon={<Smartphone size={18} />}
        label="PWA Installation"
        sub="Running in browser tab"
        badge="Browser"
        badgeColor="bg-slate-500/10 text-slate-600"
      />
    );
  }

  return (
    <SettingItem 
      icon={<Smartphone size={18} className="text-red-500" />} 
      label="PWA Installation" 
      sub="Use browser menu to 'Add to Home Screen'" 
      badge="Not Installed" 
      badgeColor="bg-red-500/10 text-red-600"
    />
  );
}

function SettingItem({ 
  icon, 
  label, 
  sub, 
  badge, 
  badgeColor,
  onPress,
  rightElement,
  danger = false
}: { 
  icon: React.ReactNode, 
  label: string, 
  sub: string, 
  badge?: string,
  badgeColor?: string,
  onPress?: () => void,
  rightElement?: React.ReactNode,
  danger?: boolean
}) {
  return (
    <Touchable onPress={onPress} className="w-full text-left" disabled={!onPress}>
      <div className="flex items-center gap-4 p-4 glass-card rounded-2xl border-border/40">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/10 text-red-500' : 'bg-secondary'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-bold text-sm tracking-tight truncate ${danger ? 'text-red-500' : ''}`}>{label}</p>
            {badge && (
              <span className={cn(
                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md flex-shrink-0",
                badgeColor || "bg-primary/10 text-primary"
              )}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5 truncate">{sub}</p>
        </div>
        {rightElement ? rightElement : (
          onPress && <ChevronRight size={16} className="ml-auto text-muted-foreground/40" />
        )}
      </div>
    </Touchable>
  );
}
