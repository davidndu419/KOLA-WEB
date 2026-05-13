'use client';

import { useState } from 'react';
import { 
  User, 
  Store, 
  Bell, 
  Lock, 
  Smartphone, 
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
import { BottomSheet } from '@/components/bottom-sheet';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { 
    business, 
    setBusiness, 
    theme, 
    setTheme, 
    notificationsEnabled, 
    setNotificationsEnabled,
    logout,
    lastSyncTime
  } = useStore();

  const [activeSheet, setActiveSheet] = useState<'profile' | 'notifications' | 'sync' | null>(null);
  const [profileForm, setProfileForm] = useState({ name: business?.name || '', address: business?.address || '' });

  const handleClearData = async () => {
    if (confirm('Are you sure? This will delete all local data!')) {
      await db.delete();
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const handleLogout = () => {
    if (confirm('Logout from this device?')) {
      logout();
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
          
          <SettingItem icon={<Smartphone size={18} />} label="PWA Installation" sub="App is currently installed" badge="Installed" />
          <SettingItem 
            icon={<Database size={18} />} 
            label="Sync Settings" 
            sub={lastSyncTime ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}` : "Not synced yet"} 
            onPress={() => setActiveSheet('sync')}
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
        <div className="space-y-6 py-6 pb-12">
           <div className="text-center space-y-2 py-4">
              <Database size={48} className="mx-auto text-primary opacity-20" />
              <h4 className="font-bold">Offline Sync Engine</h4>
              <p className="text-xs text-muted-foreground font-medium">All your data is stored locally and will sync when you are online.</p>
           </div>
           <div className="p-4 glass-card rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                 <p className="text-xs font-bold text-muted-foreground uppercase">Cloud Connection</p>
                 <span className="text-xs font-bold text-emerald-500">Connected</span>
              </div>
              <div className="flex justify-between items-center">
                 <p className="text-xs font-bold text-muted-foreground uppercase">Last Sync</p>
                 <span className="text-xs font-bold">{lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}</span>
              </div>
           </div>
           <Touchable className="w-full bg-secondary p-5 rounded-2xl font-bold text-center">
              Force Manual Sync
           </Touchable>
        </div>
      </BottomSheet>
    </div>
  );
}

function SettingItem({ 
  icon, 
  label, 
  sub, 
  badge, 
  onPress,
  danger = false
}: { 
  icon: React.ReactNode, 
  label: string, 
  sub: string, 
  badge?: string,
  onPress?: () => void,
  danger?: boolean
}) {
  return (
    <Touchable onPress={onPress} className="w-full text-left">
      <div className="flex items-center gap-4 p-4 glass-card rounded-2xl border-border/40">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/10 text-red-500' : 'bg-secondary'}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className={`font-bold text-sm tracking-tight ${danger ? 'text-red-500' : ''}`}>{label}</p>
            {badge && (
              <span className="bg-primary/10 text-primary text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">{sub}</p>
        </div>
        <ChevronRight size={16} className="ml-auto text-muted-foreground/40" />
      </div>
    </Touchable>
  );
}
