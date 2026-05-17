'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { Touchable } from '@/components/touchable';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { authService } from '@/services/authService';
import { showToast } from '@/lib/toast';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (isResending || cooldown > 0 || !email) return;
    setIsResending(true);

    try {
      await authService.resendVerificationEmail(email);
      showToast('Verification email resent. Check your inbox.');
      setCooldown(60); // 60 second cooldown
    } catch (err: any) {
      showToast(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  // Mask email for display
  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_match, start, middle, end) => 
        start + middle.replace(/./g, '•') + end
      )
    : '';

  return (
    <AuthCard title="Verify Your Email" subtitle="Please verify your email to continue">
      <div className="text-center space-y-6">
        {/* Animated mail icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center relative">
            <Mail size={36} className="text-emerald-500" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="text-white text-[10px] font-black">!</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            We sent a verification link to
          </p>
          {maskedEmail && (
            <p className="text-sm font-bold text-foreground bg-secondary/50 rounded-xl py-2.5 px-4 inline-block">
              {maskedEmail}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70 font-medium leading-relaxed max-w-[280px] mx-auto">
            Click the link in the email to verify your account. Check your spam folder if you don&apos;t see it.
          </p>
        </div>

        {/* Resend button */}
        <div className="pt-2">
          <Touchable
            onPress={handleResend}
            className={`w-full h-14 rounded-[20px] flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 ${
              cooldown > 0
                ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
          >
            {isResending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <RefreshCw size={16} className={cooldown > 0 ? '' : 'group-hover:rotate-180 transition-transform duration-500'} />
            )}
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
          </Touchable>
        </div>

        {/* Already verified? */}
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground/70 font-medium">
            Already verified?
          </p>
          <Link href="/auth/login">
            <Touchable
              onPress={() => {}}
              className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
            >
              Go to Login
            </Touchable>
          </Link>
        </div>

        <Link href="/auth/login" className="inline-block text-xs text-muted-foreground hover:text-foreground font-semibold uppercase tracking-widest transition-colors pt-1">
          ← Back to Login
        </Link>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-16 h-16 bg-emerald-500 rounded-[22px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 mb-4">
          <span className="text-white text-3xl font-black">K</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
          <Loader2 className="animate-spin" size={12} /> Loading...
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
