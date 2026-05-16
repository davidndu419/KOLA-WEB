'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Info,
  Zap,
  Receipt
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
import { notificationService } from '@/services/notificationService';

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
  const router = useRouter();

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

  const [activeSheet, setActiveSheet] = useState<'profile' | 'notifications' | null>(null);
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
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const toggleNotifications = async () => {
    const nextState = !notificationsEnabled;
    if (nextState) {
      const permission = await notificationService.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        alert('Please enable notifications in your browser settings to receive alerts.');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const saveProfile = () => {
    if (business) {
      setBusiness({ ...business, name: profileForm.name, address: profileForm.address });
      setActiveSheet(null);
    }
  };

  return (
    <div className="px-6 space-y-8">
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
            icon={<Zap size={18} />} 
            label="Service Categories" 
            sub="Manage professional services" 
            onPress={() => router.push('/settings/service-categories')}
          />
          <SettingItem
            icon={<Receipt size={18} />}
            label="Expense Categories"
            sub="Manage spending categories"
            onPress={() => router.push('/settings/expense-categories')}
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
          
          <SyncSettingItem onOpenSheet={() => router.push('/settings/sync')} />
          
          <SettingItem 
            icon={<Smartphone size={18} />} 
            label="PWA Diagnostics" 
            sub="Check offline cache status" 
            onPress={() => router.push('/settings/pwa-cache')}
          />
          
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
      <BottomSheet 
        isOpen={activeSheet === 'profile'} 
        onClose={() => setActiveSheet(null)} 
        title="Business Profile"
        dismissible={false}
      >
        <div className="space-y-6 py-6 pb-2">
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

      <BottomSheet 
        isOpen={activeSheet === 'notifications'} 
        onClose={() => setActiveSheet(null)} 
        title="Notifications"
        dismissible={false}
      >
        <div className="space-y-6 py-6 pb-2">
          <div className="flex items-center justify-between p-4 glass-card rounded-2xl">
            <div>
              <p className="font-bold text-sm">Push Notifications</p>
              <p className="text-[10px] text-muted-foreground font-bold">Alerts for stock & sales</p>
            </div>
            <button 
              onClick={toggleNotifications}
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
    </div>
  );
}

function SyncSettingItem({ onOpenSheet }: { onOpenSheet: () => void }) {
  const business = useAuthStore((state) => state.business);
  const isOnline = useOnlineStatus();
  const businessId = business?.id || business?.business_id;
  
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
