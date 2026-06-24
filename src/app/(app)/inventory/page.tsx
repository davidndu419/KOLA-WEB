'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { InventoryHeroCard } from '@/components/inventory/inventory-hero-card';
import { ProductList } from '@/components/inventory/product-list';
import { Touchable } from '@/components/touchable';
import { useInventoryMetrics } from '@/hooks/use-inventory-metrics';
import { TransactionSearchBar } from '@/components/transactions/transaction-search-bar';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const metrics = useInventoryMetrics();

  return (
    <div className="inventory-page px-6 space-y-2">
      <header className="screen-header py-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {view === 'active' ? 'Inventory' : 'Archived Stock'}
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            {view === 'active' ? 'Your business backbone' : 'Preserved history & assets'}
          </p>
        </div>

      </header>

      {metrics && view === 'active' && <InventoryHeroCard metrics={metrics} />}

      <TransactionSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search products, SKU, barcode, price..."
      />

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
    </div>
  );
}
