'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { getRuntimeMode } from '@/lib/runtime-mode';
import { Loader2, WifiOff, CloudDownload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized, user, business } = useAuth();
  const initialHydrationStatus = useAuthStore((s) => s.initialHydrationStatus);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isInitialized) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const mode = getRuntimeMode();

      if (process.env.NODE_ENV !== 'production') {
        console.log('[AuthGuard] State:', {
          mode,
          isAuthenticated,
          hasUser: !!user,
          hasBusiness: !!business,
          isOffline,
          pathname,
          initialHydrationStatus,
        });
      }

      if (!isAuthenticated) {
        // Preserve PWA source marker in the login redirect
        const loginUrl = mode === 'pwa' ? '/auth/login?source=pwa' : '/auth/login';
        router.push(loginUrl);
      } else if (isAuthenticated && !business && !isOffline && pathname !== '/auth/business-setup') {
        router.push('/auth/business-setup');
      } else if (isAuthenticated && business && pathname === '/auth/business-setup') {
        router.push('/dashboard');
      }
    }
  }, [isInitialized, isAuthenticated, business, router, pathname, user, initialHydrationStatus]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <span className="text-white text-3xl font-black">K</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
            <Loader2 className="animate-spin" size={12} /> Initializing Kola...
          </div>
        </motion.div>
      </div>
    );
  }

  // ── HYDRATION LOADING SCREEN ──
  // Show a full-screen loading state while initial data sync is in progress.
  // This prevents the dashboard from rendering with empty/partial data.
  if (isAuthenticated && business && initialHydrationStatus === 'hydrating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-5"
        >
          <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <span className="text-white text-3xl font-black">K</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2.5 text-emerald-500">
              <CloudDownload size={16} className="animate-pulse" />
              <span className="font-bold text-sm">Preparing your workspace…</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium max-w-[240px] mx-auto leading-relaxed">
              Syncing your business data. This only takes a moment.
            </p>
          </div>
          <div className="flex justify-center pt-1">
            <div className="w-32 h-1 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '90%' }}
                transition={{ duration: 8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-secondary rounded-[24px] flex items-center justify-center mx-auto text-muted-foreground/40">
          <WifiOff size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight">Session Required</h2>
          <p className="text-sm text-muted-foreground font-medium max-w-[240px] mx-auto leading-relaxed">
            Please sign in once while online to access your business offline.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => {
              const mode = getRuntimeMode();
              router.push(mode === 'pwa' ? '/auth/login?source=pwa' : '/auth/login');
            }}
            className="px-8 py-3 bg-emerald-500 text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-500/20"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="app-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
