'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { Touchable } from '@/components/touchable';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Store, ShoppingBag, Scissors, Coffee, Briefcase, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const BUSINESS_TYPES = [
  { id: 'retail', label: 'Shop / Retail', icon: Store },
  { id: 'pos', label: 'POS Operator', icon: ShoppingBag },
  { id: 'salon', label: 'Salon / Beauty', icon: Scissors },
  { id: 'restaurant', label: 'Mini Supermarket', icon: Package },
  { id: 'service', label: 'Service Business', icon: Coffee },
  { id: 'trader', label: 'Trader / Wholesaler', icon: Briefcase },
];

export default function BusinessSetupPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const business = useAuthStore((state) => state.business);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'retail',
    currency: 'NGN',
  });

  useEffect(() => {
    if (business) router.replace('/dashboard');
    if (!user) router.replace('/auth/login');
  }, [business, router, user]);

  if (!user || business) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!formData.name) {
      setError('Business name is required');
      return;
    }

    setIsLoading(true);
    try {
      await authService.setupBusiness(user.id, {
        name: formData.name,
        type: formData.type,
        currency: formData.currency,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to setup business');
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Setup Business" subtitle="Tell us about your business to get started">
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthInput
          label="Business Name"
          placeholder="e.g. Kola Enterprise"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={error || undefined}
        />

        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 px-1">
            Business Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {BUSINESS_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = formData.type === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.id })}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 gap-2",
                    isSelected 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-sm" 
                      : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon size={20} className={isSelected ? "text-emerald-500" : "text-muted-foreground/60"} />
                  <span className="text-[11px] font-bold tracking-tight uppercase">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4">
          <Touchable
            onPress={() => {}}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[20px] flex items-center justify-center font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Complete Setup'}
          </Touchable>
        </div>
      </form>
    </AuthCard>
  );
}
