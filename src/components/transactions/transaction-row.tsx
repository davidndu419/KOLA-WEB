'use client';

import React, { memo } from 'react';
import { 
  ShoppingBag, 
  Receipt, 
  Zap, 
  Clock, 
  RotateCcw, 
  Edit3, 
  ArrowUpRight, 
  ArrowDownLeft,
  Smartphone,
  CreditCard,
  Banknote,
  ShieldAlert,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { Touchable } from '@/components/touchable';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/db/schema';

export function formatTransactionListStamp(date: Date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `Today, ${date.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;
  }

  return `${date.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })} • ${date.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })}`;
}

function TransactionRowComponent({
  transaction,
  onPress,
}: {
  transaction: Transaction;
  onPress: () => void;
}) {
  const tx = transaction;

  // Configuration based on type
  const configMap: Record<string, any> = {
    sale: {
      icon: ShoppingBag,
      bgColor: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      label: 'Sale',
      amountColor: 'text-emerald-600',
      prefix: '+'
    },
    service: {
      icon: Zap,
      bgColor: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600',
      label: 'Service',
      amountColor: 'text-emerald-600',
      prefix: '+'
    },
    expense: {
      icon: Receipt,
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-600',
      label: 'Expense',
      amountColor: 'text-red-600',
      prefix: '-'
    },
    credit_payment: {
      icon: Banknote,
      bgColor: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
      label: 'Credit Payment',
      amountColor: 'text-emerald-600',
      prefix: '+'
    },
    reversal: {
      icon: RotateCcw,
      bgColor: 'bg-slate-500/10',
      iconColor: 'text-slate-600',
      label: 'Reversal',
      amountColor: 'text-slate-500',
      prefix: ''
    },
    correction: {
      icon: ShieldAlert,
      bgColor: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      label: 'Correction',
      amountColor: 'text-blue-600',
      prefix: ''
    },
    adjustment: {
      icon: Activity,
      bgColor: 'bg-slate-500/10',
      iconColor: 'text-slate-600',
      label: 'Adjustment',
      amountColor: 'text-blue-600',
      prefix: ''
    }
  };

  const config = configMap[tx.type] || {
    icon: Smartphone,
    bgColor: 'bg-slate-500/10',
    iconColor: 'text-slate-600',
    label: tx.type,
    amountColor: 'text-foreground',
    prefix: ''
  };

  const Icon = tx.status === 'reversed' ? RotateCcw : config.icon;

  return (
    <Touchable onPress={onPress} className="w-full text-left group">
      <div className="flex items-center justify-between py-4 px-1 transition-colors active:bg-secondary/40 rounded-2xl">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar Icon */}
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-active:scale-95",
            tx.status === 'reversed' ? 'bg-slate-100 text-slate-400' : config.bgColor,
            tx.status === 'reversed' ? 'text-slate-500' : config.iconColor
          )}>
            <Icon size={20} strokeWidth={2.5} />
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-black text-[15px] tracking-tight truncate">
                {tx.type === 'sale' ? (tx.note || 'Walk-in Sale') : config.label}
              </p>
              {tx.sync_status === 'synced' && (
                <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-1.5 overflow-hidden">
               <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">
                {formatTransactionListStamp(tx.created_at)}
              </p>
              <span className="text-muted-foreground/30 text-[8px]">•</span>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider truncate">
                {tx.payment_method}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
          <p className={cn(
            "font-black text-[16px] tabular-nums tracking-tighter",
            tx.status === 'reversed' ? 'text-muted-foreground/50 line-through' : config.amountColor
          )}>
            {tx.status === 'reversed' ? '' : config.prefix}₦{tx.amount.toLocaleString()}
          </p>
          
          <div className="flex gap-1.5">
            {tx.payment_method === 'credit' && tx.status !== 'reversed' && (
              <span className="bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter">
                Unpaid
              </span>
            )}
            {tx.status === 'edited' && (
              <span className="bg-blue-500/10 text-blue-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter">
                Modified
              </span>
            )}
            {tx.status === 'reversed' && (
              <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter">
                Voided
              </span>
            )}
          </div>
        </div>
      </div>
    </Touchable>
  );
}

export const TransactionRow = memo(TransactionRowComponent, (prev, next) => {
  return (
    prev.transaction.local_id === next.transaction.local_id &&
    prev.transaction.status === next.transaction.status &&
    prev.transaction.amount === next.transaction.amount &&
    prev.transaction.updated_at?.getTime() === next.transaction.updated_at?.getTime() &&
    prev.transaction.sync_status === next.transaction.sync_status
  );
});
