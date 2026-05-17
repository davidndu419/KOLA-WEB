'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { showToast } from '@/lib/toast';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Detect recovery flow before Supabase consumes the hash tokens
        const isRecovery = 
          window.location.hash.includes('type=recovery') || 
          window.location.search.includes('type=recovery');

        // Check for PKCE code flow
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        
        let sessionData;
        let sessionError;

        if (code) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          sessionData = exchangeData;
          sessionError = exchangeError;
        } else {
          // Fallback to implicit flow (hash tokens)
          const { data, error } = await supabase.auth.getSession();
          sessionData = data;
          sessionError = error;
        }

        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          setErrorMessage(sessionError.message);
          setStatus('error');
          return;
        }

        if (!sessionData.session?.user) {
          // No session established — might be an expired link
          setErrorMessage('Authentication link has expired. Please try again.');
          setStatus('error');
          return;
        }

        const user = sessionData.session.user;

        // Temporarily disabled email verification check
        // if (!user.email_confirmed_at) {
        //   showToast('Please verify your email to continue.');
        //   router.replace(`/auth/verify-email?email=${encodeURIComponent(user.email || '')}`);
        //   return;
        // }

        // If this is a password reset flow, redirect directly to the reset page
        if (isRecovery) {
          showToast('Session verified. Please set your new password.');
          router.replace('/auth/reset-password');
          return;
        }

        setStatus('success');

        // Hydrate auth via checkSession — this will:
        // 1. Detect user switch and clear stale Dexie data if needed
        // 2. Load or pull the correct business for THIS user
        // 3. Hydrate Zustand stores with the correct user/business
        await authService.checkSession();

        showToast('Successfully signed in!');

        // Determine where to redirect — re-read store AFTER checkSession
        const store = useAuthStore.getState();
        
        // Small delay for toast visibility
        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (store.business) {
          router.replace('/dashboard');
        } else {
          router.replace('/auth/business-setup');
        }
      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        setErrorMessage(err.message || 'An unexpected error occurred');
        setStatus('error');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-background dark:from-emerald-950/20 p-6">
      <div className="w-full max-w-[360px] text-center space-y-6">
        {/* Logo */}
        <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <span className="text-white text-3xl font-black">K</span>
        </div>

        {status === 'processing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
            <p className="text-sm font-bold text-foreground">Completing sign in...</p>
            <p className="text-xs text-muted-foreground font-medium">
              Please wait while we set up your session.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 size={48} className="text-emerald-500 animate-in zoom-in duration-300" />
            </div>
            <p className="text-sm font-bold text-foreground">Welcome to Kola!</p>
            <p className="text-xs text-muted-foreground font-medium">
              Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center">
                <XCircle size={32} className="text-red-500" />
              </div>
            </div>
            <p className="text-sm font-bold text-foreground">Authentication Failed</p>
            <p className="text-xs text-muted-foreground font-medium max-w-[280px] mx-auto leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/auth/login')}
              className="mt-4 px-8 py-3 bg-emerald-500 text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-600"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
