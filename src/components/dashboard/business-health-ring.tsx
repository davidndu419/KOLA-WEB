'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/animation-config';

interface BusinessHealthRingProps {
  percentage: number;
  label?: string;
  subLabel?: string;
  className?: string;
}

export function BusinessHealthRing({ 
  percentage, 
  label = 'Profit Goal',
  subLabel,
  className 
}: BusinessHealthRingProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative flex items-center gap-6 p-6 glass-card rounded-[32px]", className)}>
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background Track */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-muted/30"
          />
          {/* Progress Ring */}
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={springs.gentle}
            strokeLinecap="round"
            className={cn(
              "transition-colors",
              percentage > 75 ? "text-emerald-500" : 
              percentage > 40 ? "text-amber-500" : "text-red-500"
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xl font-bold tracking-tight"
          >
            {percentage}%
          </motion.span>
        </div>
      </div>

      <div className="flex-1 space-y-1">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </h3>
        <p className="text-lg font-bold leading-tight">
          {percentage >= 80 ? 'Exceptional Health' : 
           percentage >= 50 ? 'Stable Operation' : 'Action Required'}
        </p>
        <p className="text-xs text-muted-foreground font-medium">
          {subLabel || `Based on inventory & sales performance`}
        </p>
      </div>
    </div>
  );
}
