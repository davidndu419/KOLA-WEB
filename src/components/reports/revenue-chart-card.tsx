'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChartPoint } from '@/services/chartTransformers';
import { money } from './report-cards';

export function RevenueChartCard({ data, growthRate }: { data: ChartPoint[]; growthRate: number }) {
  const [activePoint, setActivePoint] = useState<ChartPoint | null>(null);
  const reduceMotion = useReducedMotion();
  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="bg-card border border-border/60 shadow-lg shadow-black/5 p-5 rounded-[28px] space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue Trend</p>
          <h3 className="text-xl font-bold">{money(data.reduce((total, point) => total + point.value, 0))}</h3>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-full',
            growthRate >= 0 ? 'text-emerald-600 bg-emerald-500/10' : 'text-red-600 bg-red-500/10'
          )}
        >
          {growthRate >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(growthRate)}%
        </div>
      </div>

      <div className="h-28 flex items-end justify-between gap-1.5 pt-4 touch-pan-x">
        {data.map((point) => (
          <motion.button
            type="button"
            key={point.key}
            initial={reduceMotion ? false : { height: 0 }}
            animate={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
            onPointerDown={() => setActivePoint(point)}
            onFocus={() => setActivePoint(point)}
            className="flex-1 bg-primary/20 rounded-t-lg relative outline-none min-h-1"
          >
            <span className="absolute inset-0 bg-primary opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity rounded-t-lg" />
          </motion.button>
        ))}
      </div>

      <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
        <span>{data[0]?.label || 'Start'}</span>
        <span>{activePoint ? `${activePoint.label} | ${money(activePoint.value)}` : 'Touch bars for detail'}</span>
        <span>{data[data.length - 1]?.label || 'Now'}</span>
      </div>
    </div>
  );
}
