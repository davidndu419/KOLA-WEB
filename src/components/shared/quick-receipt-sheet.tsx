// src/components/shared/quick-receipt-sheet.tsx
'use client';

import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import {
  CheckCircle2,
  Calendar,
  CreditCard,
  Hash,
  User,
  Package,
  ArrowLeftRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import Image from 'next/image';

type QuickReceiptProps = {
  isOpen: boolean;
  onClose: () => void;
  type: 'sale' | 'service' | 'expense' | 'restock' | 'reversal' | 'correction';
  amount: number;
  title: string;       // e.g. "Sale Recorded"
  subtitle?: string;   // e.g. product names, category
  businessName?: string;
  customerName?: string;
  paymentMethod?: string;
  createdAt?: Date | string;
  referenceId?: string; // Optional local_id
};

function money(v: number) {
  return `₦${(v || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function displayDate(d: Date | string) {
  return new Date(d).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const typeStyles = {
  sale: {
    iconColor: 'text-emerald-600 bg-emerald-50',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: CheckCircle2,
  },
  service: {
    iconColor: 'text-indigo-600 bg-indigo-50',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    icon: CheckCircle2,
  },
  expense: {
    iconColor: 'text-rose-600 bg-rose-50',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: TrendingDown,
  },
  restock: {
    iconColor: 'text-blue-600 bg-blue-50',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: Package,
  },
  reversal: {
    iconColor: 'text-amber-600 bg-amber-50',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: ArrowLeftRight,
  },
  correction: {
    iconColor: 'text-amber-600 bg-amber-50',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: Info,
  },
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden p-4 ${className}`}>
      {children}
    </div>
  );
}

export function QuickReceiptSheet({
  isOpen,
  onClose,
  type,
  amount,
  title,
  subtitle,
  businessName,
  customerName,
  paymentMethod,
  createdAt,
  referenceId,
}: QuickReceiptProps) {
  const styles = typeStyles[type] || typeStyles.sale;
  const IconComponent = styles.icon;
  const dateToDisplay = createdAt ? new Date(createdAt) : new Date();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Receipt Confirmation">
      <div className="space-y-4 py-3 pb-2 max-w-md mx-auto">
        
        {/* ── KOLA BRANDING HEADER ────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center pt-2 pb-4 text-center">
          <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100 overflow-hidden shadow-sm">
            <Image
              src="/logo/kola-logo.png"
              alt="Kola Logo"
              width={36}
              height={36}
              className="object-contain"
              unoptimized
            />
          </div>
          <h2 className="mt-2 text-base font-black tracking-tight text-zinc-950">KOLA</h2>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
            Offline-First Business Manager
          </p>
        </div>

        {/* ── TRANSACTION HERO CARD ───────────────────────────────────────── */}
        <Card className="text-center flex flex-col items-center py-6">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${styles.iconColor} mb-3`}>
            <IconComponent size={24} strokeWidth={2.5} />
          </div>

          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles.badgeColor}`}>
            {title}
          </span>

          <h3 className="mt-4 text-4xl font-black tracking-tight text-zinc-900 tabular-nums">
            {money(amount)}
          </h3>

          {subtitle && (
            <p className="mt-2 text-sm font-semibold text-zinc-500 max-w-[280px] line-clamp-2">
              {subtitle}
            </p>
          )}
        </Card>

        {/* ── TRANSACTION DETAIL LIST ─────────────────────────────────────── */}
        <Card className="space-y-3.5">
          {referenceId && (
            <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-50">
              <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={13} className="text-zinc-300 shrink-0" />
                Ref
              </span>
              <span className="font-mono font-bold text-zinc-800 uppercase">
                {referenceId.slice(0, 12)}
              </span>
            </div>
          )}

          {businessName && (
            <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-50">
              <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-zinc-300 shrink-0" />
                Business
              </span>
              <span className="font-black text-zinc-800">{businessName}</span>
            </div>
          )}

          {customerName && (
            <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-50">
              <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-zinc-300 shrink-0" />
                Customer
              </span>
              <span className="font-black text-zinc-800">{customerName}</span>
            </div>
          )}

          {paymentMethod && (
            <div className="flex items-center justify-between text-xs pb-3 border-b border-zinc-50">
              <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={13} className="text-zinc-300 shrink-0" />
                Payment
              </span>
              <span className="font-black text-zinc-800 uppercase">{paymentMethod}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-zinc-300 shrink-0" />
              Date & Time
            </span>
            <span className="font-bold text-zinc-800">{displayDate(dateToDisplay)}</span>
          </div>
        </Card>

        {/* ── SYSTEM CONFIRMATION SUMMARY ─────────────────────────────────── */}
        <div className="text-center py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
            ✓ Transaction Logged Successfully
          </p>
        </div>

        {/* ── DONE BUTTON ─────────────────────────────────────────────────── */}
        <div className="pt-2">
          <Touchable
            onPress={onClose}
            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-white py-4 rounded-2xl flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-500/25"
          >
            Done
          </Touchable>
        </div>

      </div>
    </BottomSheet>
  );
}
