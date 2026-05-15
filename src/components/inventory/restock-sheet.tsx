'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Package, Coins, Hash, FileText, Check } from 'lucide-react';
import { Product } from '@/db/schema';
import { inventoryService } from '@/services/inventory.service';
import { cn } from '@/lib/utils';

export function RestockSheet({ 
  product,
  isOpen, 
  onClose 
}: { 
  product: Product | null;
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const [quantity, setQuantity] = useState<string>('');
  const [cost, setCost] = useState<string>(product?.buying_price.toString() || '');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) return null;

  const handleSubmit = async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return;
    
    setIsSubmitting(true);
    try {
      await inventoryService.restock(
        product.local_id, 
        qty, 
        cost ? Number(cost) : undefined, 
        note || 'Stock replenishment'
      );
      setQuantity('');
      setNote('');
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Restock: ${product.name}`}
      dismissible={!isSubmitting}
    >
      <div className="space-y-6 py-4 pb-2">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[32px] p-6 text-center space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60">Current Availability</p>
          <p className="text-3xl font-black tracking-tighter text-emerald-600">{product.stock} {product.unit_type}s</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Quantity Added</label>
            <div className="relative">
              <Package size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="Enter amount..."
                className="w-full bg-secondary p-4 pl-12 rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">New Cost Price (Optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">₦</span>
              <input 
                type="number"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder={product.buying_price.toString()}
                className="w-full bg-secondary p-4 pl-10 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-[9px] font-bold text-muted-foreground/60 px-2 italic uppercase">Updating this will change the default cost price for this product.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Restock Note / Reference</label>
            <div className="relative">
              <FileText size={18} className="absolute left-4 top-4 text-muted-foreground" />
              <textarea 
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Supplier info, invoice number..."
                className="w-full bg-secondary p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              />
            </div>
          </div>
        </div>

        <Touchable 
          onPress={handleSubmit}
          disabled={!quantity || Number(quantity) <= 0 || isSubmitting}
          className="w-full bg-primary text-white p-5 rounded-[24px] font-bold shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check size={20} strokeWidth={3} />
              <span>Complete Restock</span>
            </>
          )}
        </Touchable>
      </div>
    </BottomSheet>
  );
}
