'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, X } from 'lucide-react';
import { InventoryHeroCard } from '@/components/inventory/inventory-hero-card';
import { ProductList } from '@/components/inventory/product-list';
import { Touchable } from '@/components/touchable';
import { useInventoryMetrics } from '@/hooks/use-inventory-metrics';

export default function InventoryPage() {
  const router = useRouter();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const metrics = useInventoryMetrics();

  return (
    <div className="px-6 space-y-2">
      <header className="py-4 flex justify-between items-end">
        <AnimatePresence mode="wait">
          {!isSearchVisible ? (
            <motion.div
              key="title"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h1 className="text-2xl font-bold tracking-tight">
                {view === 'active' ? 'Inventory' : 'Archived Stock'}
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                {view === 'active' ? 'Your business backbone' : 'Preserved history & assets'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '100%' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex-1 mr-4"
            >
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, SKUs..."
                  className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <Touchable 
            onPress={() => setIsSearchVisible(!isSearchVisible)}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
              isSearchVisible ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
            )}
          >
            {isSearchVisible ? <X size={20} /> : <Search size={20} />}
          </Touchable>
          <Touchable 
            onPress={() => setView(view === 'active' ? 'archived' : 'active')}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
              view === 'archived' ? "bg-amber-500 text-white" : "bg-secondary text-muted-foreground"
            )}
          >
            <Filter size={20} />
          </Touchable>
        </div>
      </header>

      {metrics && view === 'active' && <InventoryHeroCard metrics={metrics} />}

      <div className="flex bg-secondary/50 p-1 rounded-2xl mb-4">
        <button 
          onClick={() => setView('active')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            view === 'active' ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
          )}
        >
          Active
        </button>
        <button 
          onClick={() => setView('archived')}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            view === 'archived' ? "bg-card text-amber-600 shadow-sm" : "text-muted-foreground"
          )}
        >
          Archived
        </button>
      </div>

      <ProductList searchQuery={searchQuery} isArchived={view === 'archived'} />

      {/* Floating Action Button */}
      {!isSearchVisible && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed bottom-24 right-6 z-30"
        >
          <Touchable 
            onPress={() => router.push('/inventory/add')}
            className="w-16 h-16 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center"
          >
            <Plus size={32} strokeWidth={2.5} />
          </Touchable>
        </motion.div>
      )}
    </div>
  );
}

// Helper imported here to fix missing reference
import { cn } from '@/lib/utils';
