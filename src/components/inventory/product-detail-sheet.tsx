'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Trash2, 
  Edit3, 
  Plus, 
  History as HistoryIcon, 
  TrendingUp, 
  Info,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ChevronRight,
  Activity,
  X
} from 'lucide-react';
import { Product, ProductWithCategory, InventoryMovement } from '@/db/schema';
import { inventoryService } from '@/services/inventory.service';
import { cn } from '@/lib/utils';
import { RestockSheet } from './restock-sheet';

export function ProductDetailSheet({ 
  product: initialProduct,
  isOpen, 
  onClose 
}: { 
  product: Product | null;
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');
  const [isRestockOpen, setIsRestockOpen] = useState(false);

  // Re-fetch product and category for reactivity
  const product = useLiveQuery(async () => {
    if (!initialProduct) return null;
    const p = await db.products.where('local_id').equals(initialProduct.local_id).first();
    if (!p) return null;
    
    let categoryName = 'Uncategorized';
    if (p.category_id) {
      const cat = await db.categories.where('local_id').equals(p.category_id).first();
      if (cat) categoryName = cat.name;
    }
    
    return { ...p, category: categoryName } as ProductWithCategory;
  }, [initialProduct, isOpen]);

  // Fetch product history
  const history = useLiveQuery(async () => {
    if (!initialProduct) return [];
    
    const movements = await db.inventory_movements
      .where('product_id').equals(initialProduct.local_id)
      .toArray();

    const saleItems = await db.sale_items
      .where('product_id').equals(initialProduct.local_id)
      .toArray();

    const unifiedHistory = [
      ...movements.map(m => ({
        id: m.local_id,
        type: m.type,
        quantity: m.quantity,
        date: m.created_at,
        note: m.note || m.reason || 'Inventory movement',
        isPositive: m.type === 'stock-in' || m.type === 'return'
      })),
      ...saleItems.map(si => ({
        id: si.local_id,
        type: 'sale' as const,
        quantity: si.quantity,
        date: si.created_at,
        note: `Sold at ₦${si.unit_price.toLocaleString()}`,
        isPositive: false
      }))
    ];

    return unifiedHistory.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [initialProduct, isOpen]);

  if (!initialProduct) return null;
  
  // Use the reactive product if available, fallback to initial
  const displayProduct = product || initialProduct;
  const currentWac = displayProduct.wac_price ?? displayProduct.buying_price ?? 0;
  const totalValue = displayProduct.stock * currentWac;

  const handleArchive = async () => {
    if (confirm(`Archived products will be hidden from sales and inventory but preserved in history. Archive ${displayProduct.name}?`)) {
      await inventoryService.deleteProduct(displayProduct.local_id);
      onClose();
    }
  };

  const handleUnarchive = async () => {
    await inventoryService.updateProduct(displayProduct.local_id, { is_archived: false });
    onClose();
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Product Intelligence">
        <div className="flex flex-col min-h-[500px] max-h-[85vh]">
          {/* Hero Header */}
          <div className="flex items-center gap-5 pb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-secondary rounded-[32px] flex items-center justify-center text-muted-foreground border-2 border-border/50 shadow-inner">
                <Package size={32} />
              </div>
              {displayProduct.is_archived && (
                <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-1.5 rounded-xl shadow-lg border-2 border-background">
                  <X size={12} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight truncate">{displayProduct.name}</h2>
                {displayProduct.is_archived && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase rounded-md tracking-widest border border-amber-500/20">
                    Archived
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-black px-2.5 py-1 bg-primary/10 text-primary rounded-lg uppercase tracking-widest">
                  {(displayProduct as any).category || 'Uncategorized'}
                </span>
                <span className="text-[10px] font-black px-2.5 py-1 bg-secondary text-muted-foreground rounded-lg uppercase tracking-widest">
                  {displayProduct.sku || 'No SKU'}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-secondary/50 p-1 rounded-2xl mb-6">
            <button 
              onClick={() => setActiveTab('info')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'info' ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              <Info size={16} /> Summary
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === 'history' ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              <Activity size={16} /> History
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-none pb-4">
            {activeTab === 'info' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Stats Grid */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/40 p-4 rounded-[28px] border border-border/50">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Selling Price</p>
                      <p className="text-xl font-black tracking-tighter">₦{displayProduct.selling_price.toLocaleString()}</p>
                    </div>
                    <div className="bg-secondary/40 p-4 rounded-[28px] border border-border/50">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">WAC Cost Price</p>
                      <p className="text-xl font-black tracking-tighter text-primary">₦{currentWac.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="bg-secondary/20 p-3 px-5 rounded-2xl border border-dashed border-border/60 flex justify-between items-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Latest Purchase Cost</p>
                    <p className="text-sm font-black tracking-tight text-muted-foreground">₦{displayProduct.buying_price.toLocaleString()}</p>
                  </div>
                </div>

                {/* Inventory Card */}
                <div className="bg-primary/5 border border-primary/10 p-6 rounded-[32px] relative overflow-hidden">
                  <div className="relative z-10 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Available Stock</p>
                        <p className={cn(
                          "text-5xl font-black tracking-tighter tabular-nums transition-colors duration-500",
                          displayProduct.stock <= displayProduct.min_stock ? "text-amber-500" : "text-primary"
                        )}>
                          {displayProduct.stock}
                        </p>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-1">
                          {displayProduct.unit_type}s in warehouse
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Value</p>
                        <p className="text-lg font-black tracking-tight">₦{totalValue.toLocaleString()}</p>
                      </div>
                    </div>

                    {displayProduct.stock <= displayProduct.min_stock && !displayProduct.is_archived && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-center gap-3">
                        <TrendingUp size={16} className="text-amber-600" />
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide">
                          Low stock alert: Threshold is {displayProduct.min_stock}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="absolute -right-8 -bottom-8 text-primary/5 rotate-12">
                    <Package size={160} />
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-2xl border border-border/40">
                     <div className="flex items-center gap-3 text-muted-foreground">
                        <Clock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Date Added</span>
                     </div>
                     <span className="text-xs font-bold">{new Date(displayProduct.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                {!displayProduct.is_archived ? (
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Touchable 
                      onPress={() => setIsRestockOpen(true)}
                      className="w-full bg-primary text-white p-5 rounded-[24px] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 font-bold active:scale-95 transition-transform"
                    >
                      <Plus size={20} strokeWidth={3} /> Restock
                    </Touchable>
                    <Touchable 
                      onPress={() => router.push(`/inventory/add?id=${displayProduct.local_id}&returnToDetail=true`)}
                      className="w-full bg-secondary p-5 rounded-[24px] flex items-center justify-center gap-3 font-bold active:scale-95 transition-transform"
                    >
                      <Edit3 size={20} /> Edit Info
                    </Touchable>
                  </div>
                ) : (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-[28px] text-center space-y-3">
                    <p className="text-xs font-bold text-amber-700">This product is archived and hidden from sales.</p>
                    <Touchable 
                      onPress={handleUnarchive}
                      className="w-full bg-amber-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-lg shadow-amber-500/20"
                    >
                      <Activity size={18} /> Restore Product
                    </Touchable>
                  </div>
                )}

                {!displayProduct.is_archived && (
                  <Touchable 
                    onPress={handleArchive}
                    className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-bold opacity-60 hover:opacity-100"
                  >
                    <Trash2 size={16} /> Archive Product
                  </Touchable>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {history?.length === 0 ? (
                  <div className="text-center py-20 space-y-3 opacity-40">
                    <HistoryIcon size={48} className="mx-auto" />
                    <p className="text-xs font-black uppercase tracking-widest">No activity recorded yet</p>
                  </div>
                ) : (
                  history?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-4 group active:bg-secondary/40 px-1 rounded-2xl transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-active:scale-95",
                        item.isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"
                      )}>
                        {item.isPositive ? <ArrowDownLeft size={20} strokeWidth={2.5} /> : <ArrowUpRight size={20} strokeWidth={2.5} />}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-black text-[15px] tracking-tight capitalize truncate">
                          {item.type.replace('-', ' ')}
                        </p>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                          {item.note}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "font-black text-[16px] tabular-nums tracking-tighter",
                        item.isPositive ? "text-emerald-600" : "text-red-500"
                      )}>
                        {item.isPositive ? '+' : '-'}{item.quantity}
                      </p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                        {new Date(item.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))
                )}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      <RestockSheet 
        product={displayProduct} 
        isOpen={isRestockOpen} 
        onClose={() => setIsRestockOpen(false)} 
      />
    </>
  );
}
