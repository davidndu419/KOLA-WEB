'use client';

import { Plus, ShoppingBag, Receipt, Package, TrendingUp } from 'lucide-react';
import { Touchable } from '@/components/touchable';
import { cn } from '@/lib/utils';

const actions = [
  { icon: Plus, label: 'Sale', color: 'bg-emerald-500 shadow-emerald-500/20' },
  { icon: Package, label: 'Stock', color: 'bg-blue-500 shadow-blue-500/20' },
  { icon: Receipt, label: 'Expense', color: 'bg-red-500 shadow-red-500/20' },
  { icon: TrendingUp, label: 'Report', color: 'bg-amber-500 shadow-amber-500/20' },
];

export function QuickActions({ onAction }: { onAction?: (label: string) => void }) {
  return (
    <section className="px-6 my-8">
      <div className="flex justify-between items-center">
        {actions.map((action) => (
          <Touchable 
            key={action.label}
            onPress={() => onAction?.(action.label)}
            className="flex flex-col items-center gap-2"
          >
            <div className={cn(
              "w-14 h-14 rounded-[20px] flex items-center justify-center text-white shadow-lg transition-transform",
              action.color
            )}>
              <action.icon size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {action.label}
            </span>
          </Touchable>
        ))}
      </div>
    </section>
  );
}
