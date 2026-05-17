'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { Touchable } from '@/components/touchable';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { authService } from '@/services/authService';
import { showToast } from '@/lib/toast';

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
      await authService.sendPasswordResetEmail(email);
      setIsSuccess(true);
      showToast('Password reset link sent. Please check your email.');
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
            Click the link in the email to reset your password. If you don&apos;t see it, check your spam folder.
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
    <AuthCard title="Reset Password" subtitle="Service Temporarily Unavailable">
      <div className="space-y-6 text-center">
        <div className="p-4 rounded-[16px] bg-red-500/10 border border-red-500/20 text-red-500 font-medium text-sm">
          Password reset is temporarily unavailable while we perform maintenance on our email systems. Please contact support.
        </div>
        
        <div className="pt-2">
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
