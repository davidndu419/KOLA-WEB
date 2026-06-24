'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { getRuntimeMode } from '@/lib/runtime-mode';
import { startSupabaseAuthStateListener } from '@/services/sessionRecovery';
import { Loader2, WifiOff, CloudDownload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized, user, business } = useAuth();
  const initialHydrationStatus = useAuthStore((s) => s.initialHydrationStatus);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stopAuthListener = startSupabaseAuthStateListener();
    const handleSessionExpired = () => {
      const mode = getRuntimeMode();
      router.push(mode === 'pwa' ? '/auth/login?source=pwa' : '/auth/login');
    };

    window.addEventListener('kola:session-expired', handleSessionExpired);
    return () => {
      stopAuthListener();
      window.removeEventListener('kola:session-expired', handleSessionExpired);
    };
  }, [router]);

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

      // Public auth routes that should NEVER be intercepted by AuthGuard
      const publicAuthRoutes = [
        '/auth/login',
        '/auth/register',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/auth/callback',
        '/auth/verify-email'
      ];

      if (publicAuthRoutes.some(route => pathname.startsWith(route))) {
        return;
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
      <div className="min-h-screen flex flex-col bg-background">
        {/* Center logo zone */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Image
              src="/logo/kola-logo.png"
              alt="Kola"
              width={200}
              height={200}
              className="object-contain drop-shadow-xl"
              unoptimized
              priority
            />
          </motion.div>
        </div>

        {/* Bottom status zone */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pb-16 flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-2.5">
            <Loader2 className="animate-spin text-emerald-500" size={14} />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Initializing Kola
            </span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
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
      <div className="min-h-screen flex flex-col bg-background">
        {/* Center logo zone */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Image
              src="/logo/kola-logo.png"
              alt="Kola"
              width={200}
              height={200}
              className="object-contain drop-shadow-xl"
              unoptimized
              priority
            />
          </motion.div>
        </div>

        {/* Bottom status zone */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pb-16 px-10 flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-2 text-emerald-500">
            <CloudDownload size={14} className="animate-pulse" />
            <span className="font-black text-xs tracking-tight">Preparing your workspace</span>
          </div>
          <div className="w-40 h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '90%' }}
              transition={{ duration: 8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground font-medium text-center leading-relaxed">
            Syncing your business data…
          </p>
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
