'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { Touchable } from '@/components/touchable';
import { authService } from '@/services/authService';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // On mount, check if there's already a valid local session for this runtime mode.
  // If so, redirect straight to dashboard (handles PWA reopening after login).
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Run checkSession to rehydrate from the mode-specific auth storage
        await authService.checkSession();
        
        const store = useAuthStore.getState();
        if (store.isAuthenticated && store.user) {
          // User has a valid local session — go to dashboard
          if (store.business) {
            router.replace('/dashboard');
          } else {
            router.replace('/auth/business-setup');
          }
          return;
        }
      } catch (err) {
        // Session check failed (e.g., offline + no local session) — show login form
        console.warn('[Login] Session check failed, showing login form:', err);
      }
      setIsCheckingSession(false);
    };

    checkExistingSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    setIsLoading(true);

    if (!navigator.onLine) {
      setError('You are offline. Please connect to the internet to sign in.');
      setIsLoading(false);
      return;
    }

    try {
      await authService.signIn(formData.email, formData.password);
      
      // Check if business exists after sign in
      const business = useAuthStore.getState().business;
      if (business) {
        router.push('/dashboard');
      } else {
        router.push('/auth/business-setup');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
      setIsLoading(false);
    }
  };

  // Show loading state while checking for existing session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 mb-4">
          <span className="text-white text-3xl font-black">K</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
          <Loader2 className="animate-spin" size={12} /> Loading session...
        </div>
      </div>
    );
  }

  return (
    <AuthCard title="Welcome Back" subtitle="Log in to manage your business">
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthInput
          label="Email Address"
          type="email"
          placeholder="name@business.com"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        
        <div className="space-y-2">
          <AuthInput
            label="Password"
            type="password"
            placeholder="••••••••"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={error || undefined}
          />
          <div className="flex justify-end px-1">
            <Link href="/auth/forgot-password" hidden className="text-[11px] font-bold text-emerald-500 hover:text-emerald-600 uppercase tracking-widest">
              Forgot Password?
            </Link>
          </div>
        </div>

        <div className="pt-2">
          <Touchable
            onPress={() => {}}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Login'}
          </Touchable>
        </div>

        <div className="text-center space-y-4 pt-2">
          <p className="text-sm text-muted-foreground font-medium">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-emerald-500 hover:text-emerald-600 font-bold">
              Get Started
            </Link>
          </p>
          
          <Link href="/" className="inline-block text-xs text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest transition-colors">
            ← Back to Landing Page
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
