'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Wifi,
  WifiOff,
  Smartphone,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Touchable } from '@/components/touchable';
import { cn } from '@/lib/utils';
import { KOLA_APP_BUILD_VERSION } from '@/components/pwa-registration';
import { db } from '@/db/dexie';
import { getStorageKeys, getRuntimeMode } from '@/lib/runtime-mode';

export default function PWACachePage() {
  const router = useRouter();
  const [swStatus, setSwStatus] = useState<{
    registered: boolean;
    controlling: boolean;
    active: boolean;
    scope: string;
  }>({ registered: false, controlling: false, active: false, scope: '' });
  
  const [cacheStatus, setCacheStatus] = useState<Record<string, { 
    exists: boolean; 
    status?: number; 
    error?: string;
    loading?: boolean;
  }>>({
    '/dashboard': { exists: false },
    '/inventory': { exists: false },
    '/inventory/add': { exists: false },
    '/sales': { exists: false },
    '/sales/credit': { exists: false },
    '/service': { exists: false },
    '/service/credit': { exists: false },
    '/expenses': { exists: false },
    '/reports': { exists: false },
    '/reports/transactions': { exists: false },
    '/settings': { exists: false },
    '/settings/sync': { exists: false },
    '/settings/pwa-cache': { exists: false },
    '/settings/service-categories': { exists: false },
    '/settings/expense-categories': { exists: false },
    '/offline': { exists: false },
    '/manifest.json': { exists: false }
  });
  
  const [isOnline, setIsOnline] = useState(true);
  const [isCaching, setIsCaching] = useState(false);
  const [cacheNames, setCacheNames] = useState<string[]>([]);
  const [versionInfo, setVersionInfo] = useState({
    appBuildVersion: KOLA_APP_BUILD_VERSION,
    cachedBuildVersion: '',
    staleCache: false,
    indexedDbVersion: 0,
    dbVersionChangeAt: '',
  });

  const checkStatus = async () => {
    setIsOnline(navigator.onLine);
    const keys = getStorageKeys();
    const cachedBuildVersion = localStorage.getItem(keys.appBuildVersion) || '';
    setVersionInfo({
      appBuildVersion: KOLA_APP_BUILD_VERSION,
      cachedBuildVersion,
      staleCache: !!cachedBuildVersion && cachedBuildVersion !== KOLA_APP_BUILD_VERSION,
      indexedDbVersion: db.verno,
      dbVersionChangeAt: localStorage.getItem(keys.dbVersionChangeAt) || '',
    });
    
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const registration = registrations.find(r => r.scope === window.location.origin + '/');
      
      setSwStatus({
        registered: !!registration,
        controlling: !!navigator.serviceWorker.controller,
        active: !!registration?.active,
        scope: registration?.scope || ''
      });
    }

    const routes = Object.keys(cacheStatus);
    const newStatus = { ...cacheStatus };

    for (const route of routes) {
      const match = await caches.match(route);
      newStatus[route] = { 
        ...newStatus[route],
        exists: !!match 
      };
    }
    
    setCacheStatus(newStatus);

    const names = await caches.keys();
    setCacheNames(names);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCacheNow = async () => {
    if (typeof (window as any).cacheEssentialAppShell === 'function') {
      setIsCaching(true);
      
      // Set all to loading
      const loadingStatus = { ...cacheStatus };
      Object.keys(loadingStatus).forEach(key => loadingStatus[key].loading = true);
      setCacheStatus(loadingStatus);

      const results = await (window as any).cacheEssentialAppShell();
      
      const finalStatus = { ...cacheStatus };
      Object.entries(results).forEach(([route, res]: [string, any]) => {
        if (finalStatus[route]) {
          finalStatus[route] = {
            exists: res.success,
            status: res.status,
            error: res.error,
            loading: false
          };
        }
      });
      
      setCacheStatus(finalStatus);
      setIsCaching(false);
      await checkStatus();
    } else {
      alert('Manual cache utility not found. Service worker might not be ready.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-4 px-4 h-16 glassmorphism border-b border-border/40 safe-area-pt">
        <Touchable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <ChevronLeft size={24} />
        </Touchable>
        <h1 className="text-xl font-bold tracking-tight text-emerald-500">PWA Diagnostics</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
        {/* Connection Section */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Network Status</h3>
          <div className="glass-card rounded-[24px] p-5 flex items-center justify-between border border-border/40 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                isOnline ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              )}>
                {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <div>
                <p className="text-sm font-bold">{isOnline ? 'Online' : 'Offline'}</p>
                <p className="text-[10px] font-medium text-muted-foreground">Browser connectivity status</p>
              </div>
            </div>
          </div>
        </section>

        {/* Service Worker Section */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Service Worker</h3>
          <div className="glass-card rounded-[24px] p-6 space-y-4 border border-border/40 shadow-sm">
            <DiagnosticRow label="Registered" success={swStatus.registered} />
            <DiagnosticRow label="Controlling Page" success={swStatus.controlling} />
            <DiagnosticRow label="Active Status" success={swStatus.active} />
            <DiagnosticRow label="Cache Version Current" success={!versionInfo.staleCache} />
            <div className="pt-2">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Scope</p>
              <p className="text-[11px] font-mono text-foreground break-all bg-secondary/50 p-2 rounded-lg">{swStatus.scope || 'None'}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-2">
              <VersionLine label="App Build" value={versionInfo.appBuildVersion} />
              <VersionLine label="Cached Build" value={versionInfo.cachedBuildVersion || 'Not recorded'} />
              <VersionLine label="IndexedDB Version" value={versionInfo.indexedDbVersion.toString()} />
              {versionInfo.dbVersionChangeAt && (
                <VersionLine label="Last DB Version Change" value={versionInfo.dbVersionChangeAt} />
              )}
            </div>
          </div>
        </section>

        {/* Cache Storage Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">App Shell Cache</h3>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Cache Storage</span>
          </div>
          <div className="glass-card rounded-[24px] p-6 space-y-4 border border-border/40 shadow-sm">
            {Object.entries(cacheStatus).map(([route, info]) => (
              <DiagnosticRow 
                key={route} 
                label={route} 
                success={info.exists} 
                loading={info.loading}
                status={info.status}
                error={info.error}
              />
            ))}
            
            <div className="pt-2 border-t border-border/40">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-2">Available Caches</p>
              <div className="flex flex-wrap gap-2">
                {cacheNames.length > 0 ? cacheNames.map(name => (
                  <span key={name} className="text-[10px] font-bold bg-secondary px-2 py-1 rounded-md text-muted-foreground">{name}</span>
                )) : (
                  <span className="text-[10px] font-bold text-red-400">No caches found</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="space-y-4">
          <Touchable
            onPress={handleCacheNow}
            disabled={isCaching || !isOnline}
            className={cn(
              "w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
              isOnline ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-secondary text-muted-foreground"
            )}
          >
            <Zap size={18} className={cn(isCaching && "animate-pulse")} />
            {isCaching ? 'Caching App Shell...' : 'Cache App Shell Now'}
          </Touchable>
          {!isOnline && (
            <p className="text-[10px] text-center text-red-400 font-bold uppercase tracking-widest">
              Internet required for caching
            </p>
          )}
        </section>

        {/* Cold Start Verification */}
        <section className="p-6 rounded-[32px] bg-secondary/30 border border-border/40 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-emerald-500 shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold">Cold Start Verification</h3>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
            To verify true offline cold-start support:
          </p>
          <ol className="text-[11px] font-medium text-muted-foreground space-y-2 list-decimal pl-4">
            <li>Ensure all routes above show a green checkmark.</li>
            <li>Close the PWA and remove it from recent apps.</li>
            <li>Turn off internet on your device.</li>
            <li>Tap the PWA icon. The dashboard should load immediately.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}

function DiagnosticRow({ 
  label, 
  success, 
  loading,
  status,
  error 
}: { 
  label: string; 
  success: boolean; 
  loading?: boolean;
  status?: number;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-foreground truncate max-w-[150px]">{label}</p>
        <div className="flex items-center gap-1.5">
          {loading ? (
            <div className="flex items-center gap-1.5 text-primary">
              <span className="text-[10px] font-black uppercase tracking-widest">Caching</span>
              <RefreshCw size={14} className="animate-spin" />
            </div>
          ) : success ? (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <span className="text-[10px] font-black uppercase tracking-widest">Ready</span>
              <CheckCircle2 size={16} />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-red-400">
              <span className="text-[10px] font-black uppercase tracking-widest">
                {status ? `Error ${status}` : 'Missing'}
              </span>
              <XCircle size={16} />
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="text-[9px] text-red-400 font-medium bg-red-500/5 p-1 rounded border border-red-500/10 break-all">
          {error}
        </p>
      )}
    </div>
  );
}

function VersionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-[10px] font-mono text-right text-foreground break-all">{value}</p>
    </div>
  );
}
