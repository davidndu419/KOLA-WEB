// src/components/typography.tsx
'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface BalanceDisplayProps {
  amount: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

export function BalanceDisplay({ 
  amount, 
  currency = '₦',
  size = 'lg',
  className,
  animate = true
}: BalanceDisplayProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
  };

  const formattedAmount = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <motion.div 
      initial={animate ? { opacity: 0, scale: 0.95 } : false}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('font-bold tracking-tight flex items-baseline gap-1', sizeClasses[size], className)}
    >
      <span className="text-[0.65em] font-semibold opacity-70">
        {currency}
      </span>
      <span className="tabular-nums">{formattedAmount}</span>
    </motion.div>
  );
}

export function KPIValue({ 
  value, 
  label,
  trend,
  className 
}: {
  value: string | number;
  label: string;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      {trend && (
        <p className={cn(
          'text-xs font-bold flex items-center gap-1',
          trend.isPositive ? 'text-emerald-500' : 'text-red-500'
        )}>
          {trend.isPositive ? '↑' : '↓'}
          {Math.abs(trend.value)}%
        </p>
      )}
    </div>
  );
}

export function TransactionAmount({
  amount,
  type,
  className,
}: {
  amount: number;
  type: 'income' | 'expense';
  className?: string;
}) {
  const isIncome = type === 'income';
  
  return (
    <span className={cn(
      'font-bold tabular-nums',
      isIncome ? 'text-emerald-500' : 'text-foreground',
      className
    )}>
      {isIncome ? '+' : '-'}₦{amount.toLocaleString()}
    </span>
  );
}
