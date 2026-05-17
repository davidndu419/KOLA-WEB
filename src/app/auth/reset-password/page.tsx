'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { Touchable } from '@/components/touchable';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // On mount, check if the user arrived via a valid reset link
  // Supabase will have exchanged the token for a session by the time we reach this page
  useEffect(() => {
    const checkResetSession = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const hash = window.location.hash;
        
        console.log('[ResetPassword] checkResetSession starting. Code present:', !!code, 'Hash present:', !!hash);
        
        let sessionValid = false;

        if (code) {
          // Handle PKCE flow
          console.log('[ResetPassword] Attempting exchangeCodeForSession...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (data.session && !error) {
            console.log('[ResetPassword] exchangeCodeForSession SUCCESS');
            sessionValid = true;
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.error('[ResetPassword] PKCE error:', error);
          }
        } else {
          // Handle implicit flow (hash tokens) or existing session
          console.log('[ResetPassword] Attempting getSession...');
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            console.log('[ResetPassword] getSession SUCCESS');
            sessionValid = true;
          } else {
             console.log('[ResetPassword] getSession returned no session');
          }
        }

        setIsValidSession(sessionValid);
      } catch (err) {
        console.error('[ResetPassword] Session check failed:', err);
        setIsValidSession(false);
      }
    };

    checkResetSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      console.log('[ResetPassword] Attempting updateUser...');
      await authService.updatePassword(formData.password);
      
      console.log('[ResetPassword] updateUser returned success. Verifying session...');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        throw new Error(`Verification failed after update: ${userError?.message || 'No user'}`);
      }
      
      console.log('[ResetPassword] Session verified. Signing out...');
      
      // Destroy the recovery session locally so they must log in again
      await authService.signOut();
      
      setIsSuccess(true);
      showToast('Password updated successfully! Please log in.');
    } catch (err: any) {
      console.error('[ResetPassword] Update failed:', err);
      setError(err.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  // Still checking session validity
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 mb-4">
          <span className="text-white text-3xl font-black">K</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
          <Loader2 className="animate-spin" size={12} /> Verifying reset link...
        </div>
      </div>
    );
  }

  // Invalid/expired reset link
  if (!isValidSession) {
    return (
      <AuthCard title="Link Expired" subtitle="This password reset link is no longer valid">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle size={32} className="text-amber-500" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            The reset link may have expired or already been used. Please request a new one.
          </p>
          <div className="space-y-3 pt-2">
            <Link href="/auth/forgot-password">
              <Touchable
                onPress={() => {}}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
              >
                Request New Link
              </Touchable>
            </Link>
            <Link href="/auth/login" className="inline-block w-full text-center text-xs text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest transition-colors pt-2">
              ← Back to Login
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  // Success — password updated
  if (isSuccess) {
    return (
      <AuthCard title="Password Updated" subtitle="Your password has been changed successfully">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 size={64} className="text-emerald-500 animate-in zoom-in duration-300" />
          </div>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            You can now log in with your new password.
          </p>
          <div className="pt-4">
            <Touchable
              onPress={() => router.push('/auth/login')}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
            >
              Go to Login
            </Touchable>
          </div>
        </div>
      </AuthCard>
    );
  }

  // Reset password form
  return (
    <AuthCard title="New Password" subtitle="Enter your new password below">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="New Password"
          type="password"
          placeholder="••••••••"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        />
        
        <AuthInput
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          required
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          error={error || undefined}
        />

        <div className="pt-2">
          <Touchable
            onPress={() => {}}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Update Password'}
          </Touchable>
        </div>
      </form>
    </AuthCard>
  );
}
