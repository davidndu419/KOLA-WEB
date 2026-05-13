'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, TrendingUp, CloudCheck, CloudOff, Calendar } from 'lucide-react';
import { BalanceDisplay } from '@/components/typography';
import { Touchable } from '@/components/touchable';
import { springs } from '@/lib/animation-config';
import { cn } from '@/lib/utils';
import { DateRange } from './date-range-picker-sheet';

interface HeroBalanceCardProps {
  balance: number;
  todayProfit: number;
  monthlyGoal?: number;
  netProfit?: number;
  isSynced?: boolean;
  selectedRange: DateRange;
  onOpenDatePicker: () => void;
  customDate?: Date;
}

export function HeroBalanceCard({ 
  balance, 
  todayProfit,
  monthlyGoal = 0,
  netProfit = 0,
  isSynced = true,
  selectedRange,
  onOpenDatePicker,
  customDate
}: HeroBalanceCardProps) {
  const [isVisible, setIsVisible] = useState(true);

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.default}
      className="relative mx-4 mt-2 p-6 rounded-[32px] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-2xl shadow-emerald-900/20 overflow-hidden"
    >
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest">
               {selectedRange === 'allTime' ? 'Total Business Balance' : `Balance (${rangeLabels[selectedRange]})`}
            </p>
            <button 
              onClick={() => setIsVisible(!isVisible)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <Touchable 
              onPress={onOpenDatePicker}
              className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-full backdrop-blur-md border border-white/10"
            >
              <Calendar size={12} className="text-white/80" />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                {rangeLabels[selectedRange]}
              </span>
            </Touchable>

            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-full backdrop-blur-md">
              {isSynced ? (
                <CloudCheck size={12} className="text-emerald-300" />
              ) : (
                <CloudOff size={12} className="text-amber-300" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-tight">
                {isSynced ? 'Synced' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isVisible ? (
            <BalanceDisplay 
              amount={balance} 
              size="lg" 
              className="text-white" 
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-4xl font-bold tracking-tighter py-1"
            >
              ••••••••
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/30 rounded-lg">
            <TrendingUp size={12} />
            <span className="text-xs font-bold">+₦{todayProfit.toLocaleString()} today</span>
          </div>
          <span className="text-white/60 text-[10px] font-medium italic">
             Data-driven insights active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <Touchable className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-3 text-left transition-colors">
            <p className="text-white/60 text-[9px] uppercase font-bold tracking-widest mb-1">Monthly Goal</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{monthlyGoal}%</span>
              <span className="text-[10px] text-emerald-300 font-bold">{monthlyGoal >= 100 ? 'Done' : 'Progress'}</span>
            </div>
          </Touchable>
          
          <Touchable className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-3 text-left transition-colors">
            <p className="text-white/60 text-[9px] uppercase font-bold tracking-widest mb-1">Net Profit</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">₦{netProfit >= 1000000 ? `${(netProfit / 1000000).toFixed(1)}M` : netProfit.toLocaleString()}</span>
              <span className="text-[10px] text-white/60 font-medium">Month</span>
            </div>
          </Touchable>
        </div>
      </div>
    </motion.div>
  );
}
