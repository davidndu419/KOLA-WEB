'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { Touchable } from '@/components/touchable';
import { authService } from '@/services/authService';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    // Validation
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
      await authService.signUp(formData.email, formData.password, formData.fullName);
      router.push('/auth/business-setup');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Create Account" subtitle="Start managing your business smarter today">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthInput
          label="Full Name"
          placeholder="e.g. David Kola"
          required
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        />
        
        <AuthInput
          label="Email Address"
          type="email"
          placeholder="name@business.com"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        
        <AuthInput
          label="Password"
          type="password"
          placeholder="••••••••"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        />
        
        <AuthInput
          label="Confirm Password"
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
            {isLoading ? <Loader2 className="animate-spin" /> : 'Create Account'}
          </Touchable>
        </div>

        <p className="text-center text-sm text-muted-foreground font-medium pt-2">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-emerald-500 hover:text-emerald-600 font-bold">
            Login
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
