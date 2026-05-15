// src/components/inventory/product-detail-sheet.tsx
'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Package, Trash2, Edit3, Plus, Minus, History } from 'lucide-react';
import { Product, ProductWithCategory } from '@/db/schema';
import { inventoryService } from '@/services/inventory.service';

import { cn } from '@/lib/utils';

export function ProductDetailSheet({ 
  product,
  isOpen, 
  onClose 
}: { 
  product: ProductWithCategory | null;
  isOpen: boolean; 
  onClose: () => void; 
}) {

  const [isEditingStock, setIsEditingStock] = useState(false);
  const [adjustment, setAdjustment] = useState(0);

  if (!product) return null;

  const handleAdjustStock = async () => {
    if (adjustment === 0) return;
    try {
      if (adjustment > 0) {
        await inventoryService.restock(product.local_id, adjustment, undefined, 'Manual adjustment');
      } else {
        // For negative adjustment, we use the same adjustStock logic via service
        // Actually our service has restock but we can add a generic adjustment
        await inventoryService.restock(product.local_id, adjustment, undefined, 'Manual adjustment');
      }
      setAdjustment(0);
      setIsEditingStock(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleArchive = async () => {
    if (confirm(`Are you sure you want to archive ${product.name}?`)) {
      await inventoryService.deleteProduct(product.local_id);
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Product Details">
      <div className="space-y-8 py-4 pb-2">
        {/* Product Header */}
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 bg-secondary rounded-[32px] flex items-center justify-center text-muted-foreground border-2 border-border/50">
            <Package size={32} />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-xl font-bold tracking-tight">{product.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-lg uppercase tracking-wider">
                {product.category}
              </span>

              <span className="text-[10px] font-bold px-2 py-1 bg-secondary text-muted-foreground rounded-lg uppercase tracking-wider">
                {product.sku || 'No SKU'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 rounded-3xl space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Selling Price</p>
            <p className="text-xl font-bold tracking-tight">₦{product.selling_price.toLocaleString()}</p>
          </div>
          <div className="glass-card p-4 rounded-3xl space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cost Price</p>
            <p className="text-xl font-bold tracking-tight text-muted-foreground">₦{product.buying_price.toLocaleString()}</p>
          </div>
        </div>

        {/* Stock Management */}
        <div className="glass-card p-6 rounded-[32px] space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Stock</p>
              <p className={cn(
                "text-4xl font-black tracking-tighter tabular-nums",
                product.stock <= product.min_stock ? "text-amber-500" : "text-emerald-500"
              )}>
                {product.stock} <span className="text-lg font-bold text-muted-foreground uppercase">{product.unit_type}s</span>
              </p>
            </div>
            <Touchable 
              onPress={() => setIsEditingStock(!isEditingStock)}
              className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <Plus size={24} />
            </Touchable>
          </div>

          {isEditingStock && (
            <div className="pt-4 border-t border-border/50 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-center gap-8">
                <Touchable 
                  onPress={() => setAdjustment(prev => prev - 1)}
                  className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center"
                >
                  <Minus size={24} />
                </Touchable>
                <div className="text-center">
                  <p className={cn(
                    "text-3xl font-bold tabular-nums",
                    adjustment > 0 ? "text-emerald-500" : adjustment < 0 ? "text-red-500" : ""
                  )}>
                    {adjustment > 0 ? '+' : ''}{adjustment}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Adjustment</p>
                </div>
                <Touchable 
                  onPress={() => setAdjustment(prev => prev + 1)}
                  className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center"
                >
                  <Plus size={24} />
                </Touchable>
              </div>
              <Touchable 
                onPress={handleAdjustStock}
                disabled={adjustment === 0}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl disabled:opacity-50"
              >
                Confirm Stock Change
              </Touchable>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Touchable className="w-full bg-secondary p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm">
            <Edit3 size={18} /> Edit Info
          </Touchable>
          <Touchable 
            onPress={handleArchive}
            className="w-full bg-red-50 text-red-600 p-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
          >
            <Trash2 size={18} /> Archive
          </Touchable>
        </div>
      </div>
    </BottomSheet>
  );
}
