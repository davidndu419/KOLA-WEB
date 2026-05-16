'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { money } from '@/components/reports/report-cards';
import { Touchable } from '@/components/touchable';

interface StatRow {
  label: string;
  value: string | number;
  color?: string;
}

export type HeroVariant = 'red' | 'emerald' | 'indigo' | 'slate' | 'blue' | 'amber';

interface HeroSummaryCardProps {
  title: string;
  subtitle: string;
  mainValue: string | number;
  icon: LucideIcon;
  stats: StatRow[];
  variant?: HeroVariant;
  className?: string;
  watermarkIcon?: LucideIcon;
  rangeLabel?: string;
  onOpenDatePicker?: () => void;
  secondaryAction?: {
    icon: LucideIcon;
    onPress: () => void;
    label?: string;
  };
}

const variantStyles: Record<HeroVariant, string> = {
  red: "bg-gradient-to-br from-red-600 to-red-800 shadow-red-900/30",
  emerald: "bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-emerald-900/30",
  indigo: "bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-indigo-900/30",
  slate: "bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-900/30",
  blue: "bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-900/30",
  amber: "bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-900/30",
};

export function HeroSummaryCard({
  title,
  subtitle,
  mainValue,
  icon: Icon,
  stats,
  variant = 'emerald',
  className,
  watermarkIcon: WatermarkIcon,
  rangeLabel,
  onOpenDatePicker,
  secondaryAction,
}: HeroSummaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-[28px] p-6 text-white shadow-2xl transition-all",
        variantStyles[variant],
        className
      )}
    >
      {/* Background patterns */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />
      
      {WatermarkIcon && (
        <WatermarkIcon 
          size={140} 
          className="absolute -right-8 -bottom-8 opacity-5 text-white pointer-events-none" 
          strokeWidth={1}
        />
      )}

      <div className="relative z-10 space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
            <h2 className="text-xs font-bold text-white/90 leading-tight max-w-[180px]">{subtitle}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            {secondaryAction && (
              <Touchable
                onPress={secondaryAction.onPress}
                className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-90 transition-transform"
              >
                <secondaryAction.icon size={18} />
              </Touchable>
            )}
            
            {onOpenDatePicker && (
              <Touchable
                onPress={onOpenDatePicker}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-xl rounded-xl border border-white/20 active:scale-95 transition-transform"
              >
                <Calendar size={14} className="text-white/80" />
                <span className="text-[10px] font-bold uppercase tracking-tight whitespace-nowrap">
                  {rangeLabel || 'Period'}
                </span>
                <ChevronDown size={12} className="text-white/60" />
              </Touchable>
            )}

            {!onOpenDatePicker && !secondaryAction && (
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                <Icon size={20} />
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-3xl font-black tracking-tighter">
            {typeof mainValue === 'number' ? money(mainValue) : mainValue}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-y-4 gap-x-6 pt-5 border-t border-white/10">
          {stats.map((stat, index) => {
            const isMoney = typeof stat.value === 'number' && 
              (stat.label.toLowerCase().includes('total') || 
               stat.label.toLowerCase().includes('revenue') || 
               stat.label.toLowerCase().includes('profit') ||
               stat.label.toLowerCase().includes('expense') ||
               stat.label.toLowerCase().includes('balance') ||
               stat.label.toLowerCase().includes('value') ||
               stat.label.toLowerCase().includes('amount')) &&
              !stat.label.toLowerCase().includes('records') &&
              !stat.label.toLowerCase().includes('count') &&
              !stat.label.toLowerCase().includes('items');

            return (
              <div key={index} className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{stat.label}</p>
                <p className={cn("text-sm font-black tabular-nums", stat.color || "text-white")}>
                  {isMoney ? money(stat.value as number) : stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
