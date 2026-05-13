// src/components/inventory/inventory-hero-card.tsx
'use client';

import { motion } from 'framer-motion';
import { Package, TrendingUp, AlertTriangle, Coins, BarChart3 } from 'lucide-react';
import { KPIValue } from '@/components/typography';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/animation-config';

interface InventoryHeroCardProps {
  metrics: {
    totalValue: number;
    potentialProfit: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

export function InventoryHeroCard({ metrics }: InventoryHeroCardProps) {
  return (
    <div className="space-y-4 mb-8">
      {/* Primary Value Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.default}
        className="relative p-6 rounded-[32px] bg-gradient-to-br from-zinc-900 to-zinc-800 text-white shadow-2xl overflow-hidden border border-white/5"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
              <Package size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                Inventory Value
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Potential Profit</p>
              <p className="text-lg font-bold text-emerald-400">
                +₦{metrics.potentialProfit.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              ₦{metrics.totalValue.toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Total Products</p>
              <p className="text-xl font-bold">{metrics.totalProducts}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase text-white/40 mb-1">Stock Status</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{metrics.totalProducts - metrics.lowStockCount - metrics.outOfStockCount}</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md">Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alerts Row */}
      {(metrics.lowStockCount > 0 || metrics.outOfStockCount > 0) && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-1">
          {metrics.outOfStockCount > 0 && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex-shrink-0 flex items-center gap-3 p-3 bg-red-500/10 rounded-2xl border border-red-500/20 min-w-[200px]"
            >
              <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                <AlertTriangle size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-red-500">{metrics.outOfStockCount} Out of Stock</p>
                <p className="text-[10px] font-medium text-red-500/70">Requires immediate restock</p>
              </div>
            </motion.div>
          )}
          
          {metrics.lowStockCount > 0 && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex-shrink-0 flex items-center gap-3 p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 min-w-[200px]"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                <BarChart3 size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-500">{metrics.lowStockCount} Low Stock</p>
                <p className="text-[10px] font-medium text-amber-500/70">Reorder soon</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
