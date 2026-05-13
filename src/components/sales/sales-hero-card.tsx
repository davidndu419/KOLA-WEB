// src/components/sales/sales-hero-card.tsx
'use client';

import { motion } from 'framer-motion';
import { ShoppingBag, TrendingUp, CreditCard, Users, Calendar } from 'lucide-react';
import { KPIValue } from '@/components/typography';
import { springs } from '@/lib/animation-config';
import { DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { Touchable } from '@/components/touchable';

interface SalesHeroCardProps {
  totalSales: number;
  transactionCount: number;
  receivables: number;
  cashPercentage: number;
  selectedRange: DateRange;
  onOpenDatePicker: () => void;
  customDate?: Date;
}

export function SalesHeroCard({ 
  totalSales, 
  transactionCount, 
  receivables, 
  cashPercentage,
  selectedRange,
  onOpenDatePicker,
  customDate
}: SalesHeroCardProps) {
  const rangeLabels: Record<DateRange, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    last7days: 'Last 7 Days',
    last30days: 'Last 30 Days',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    thisYear: 'This Year',
    allTime: 'All Time',
    custom: customDate ? customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Custom'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.default}
      className="relative p-6 rounded-[32px] bg-gradient-to-br from-zinc-900 to-zinc-800 text-white shadow-2xl overflow-hidden border border-white/5 mb-6"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Total Sales</p>
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-400" />
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
                Performance
              </span>
            </div>
          </div>
          
          <Touchable 
            onPress={onOpenDatePicker}
            className="flex items-center gap-2 px-3 py-2 bg-primary/20 rounded-2xl border border-primary/30 backdrop-blur-md shadow-lg shadow-primary/10"
          >
            <Calendar size={14} className="text-primary" />
            <div className="text-left">
              <p className="text-[8px] font-black uppercase tracking-tighter text-primary/80 leading-none">Period</p>
              <p className="text-[10px] font-bold text-white leading-none mt-1">
                {rangeLabels[selectedRange]}
              </p>
            </div>
          </Touchable>
        </div>

        <div className="mb-8">
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            ₦{totalSales.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
            {transactionCount} Successful Transactions
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Average Sale</p>
            <p className="text-xl font-bold">
              ₦{transactionCount > 0 ? Math.round(totalSales / transactionCount).toLocaleString() : 0}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Cash Mix</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-400">{cashPercentage}% Cash flow</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
