'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { Touchable } from '@/components/touchable';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthCard title="Check Email" subtitle="We've sent a reset link to your email">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 size={64} className="text-emerald-500 animate-in zoom-in duration-300" />
          </div>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            Click the link in the email to reset your password. If you don't see it, check your spam folder.
          </p>
          <div className="pt-4">
            <Link href="/auth/login">
              <Touchable
                onPress={() => {}}
                className="w-full h-14 bg-secondary text-foreground rounded-[20px] flex items-center justify-center font-bold text-base transition-colors"
              >
                Return to Login
              </Touchable>
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset Password" subtitle="Enter your email to receive a reset link">
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthInput
          label="Email Address"
          type="email"
          placeholder="name@business.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error || undefined}
        />

        <div className="pt-2">
          <Touchable
            onPress={() => {}}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
          </Touchable>
        </div>

        <div className="text-center pt-2">
          <Link href="/auth/login" className="inline-block text-xs text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest transition-colors">
            ← Back to Login
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
