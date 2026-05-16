// src/components/service/service-hero-card.tsx
'use client';

import { motion } from 'framer-motion';
import { Briefcase, Calendar } from 'lucide-react';
import { springs } from '@/lib/animation-config';
import { DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { Touchable } from '@/components/touchable';

interface ServiceHeroCardProps {
  totalServiceRevenue: number;
  serviceCount: number;
  selectedRange: DateRange;
  onOpenDatePicker: () => void;
  customDate?: Date;
}

export function ServiceHeroCard({ 
  totalServiceRevenue, 
  serviceCount,
  selectedRange,
  onOpenDatePicker,
  customDate
}: ServiceHeroCardProps) {
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
      className="relative p-5 rounded-[28px] bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-xl overflow-hidden border border-white/5 mb-4"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-300" />
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
              Performance
            </span>
          </div>
          
          <Touchable 
            onPress={onOpenDatePicker}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 backdrop-blur-md shadow-lg shadow-indigo-900/20"
          >
            <Calendar size={14} className="text-indigo-300" />
            <div className="text-left">
              <p className="text-[8px] font-black uppercase tracking-tighter text-indigo-200 leading-none">Period</p>
              <p className="text-[10px] font-bold text-white leading-none mt-1">
                {rangeLabels[selectedRange]}
              </p>
            </div>
          </Touchable>
        </div>

        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            ₦{totalServiceRevenue.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
            {serviceCount} Services Rendered
          </p>
        </div>
      </div>
    </motion.div>
  );
}
