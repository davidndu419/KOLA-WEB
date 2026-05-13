'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { salesService } from '@/services/sales.service';
import { useStore } from '@/store/use-store';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Search, ShoppingBag, User, Plus, Minus, X } from 'lucide-react';
import { ReceiptSheet } from './receipt-sheet';
import { cn } from '@/lib/utils';
import { Transaction } from '@/db/schema';

export function RecordSaleSheet({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { business } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ productId: string; name: string; quantity: number; price: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const products = useLiveQuery(async () => {
    if (!searchQuery) return [];
    return await db.products
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && p.stock > 0 && !p.isArchived)
      .limit(5)
      .toArray();
  }, [searchQuery]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.localId);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert('Cannot add more than available stock');
          return prev;
        }
        return prev.map(item => 
          item.productId === product.localId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { productId: product.localId, name: product.name, quantity: 1, price: product.sellingPrice }];
    });
    setSearchQuery('');
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleConfirm = async () => {
    if (cart.length === 0 || !business) return;
    
    try {
      const recordedTx = await salesService.recordSale({
        amount: totalAmount,
        paymentMethod,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        customerName: customerName || undefined,
        customerId: paymentMethod === 'credit' ? 'walk-in-customer' : undefined,
      }, business.id);

      setCart([]);
      setCustomerName('');
      setLastTransaction(recordedTx);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record sale');
    }
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Record Sale" bottomOffset={64}>
        <div className="space-y-6 py-4 pb-10">
          {/* Product Search */}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products to add..."
              className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
            />
            {searchQuery && products && products.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-card border border-border mt-2 rounded-2xl shadow-xl z-50 overflow-hidden">
                {products.map(p => (
                  <button 
                    key={p.localId}
                    onClick={() => addToCart(p)}
                    className="w-full p-4 text-left hover:bg-secondary flex justify-between items-center transition-colors border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">{p.stock} in stock</p>
                    </div>
                    <p className="font-bold text-primary">₦{p.sellingPrice.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                <div className="flex-1">
                  <p className="font-bold text-sm">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">₦{item.price.toLocaleString()} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <Touchable 
                    onPress={() => setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                    className="w-8 h-8 rounded-lg bg-card flex items-center justify-center border border-border"
                  >
                    <Minus size={14} />
                  </Touchable>
                  <span className="font-bold tabular-nums w-4 text-center">{item.quantity}</span>
                  <Touchable 
                    onPress={() => setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))}
                    className="w-8 h-8 rounded-lg bg-card flex items-center justify-center border border-border"
                  >
                    <Plus size={14} />
                  </Touchable>
                  <button onClick={() => setCart(prev => prev.filter(i => i.productId !== item.productId))} className="ml-2 text-muted-foreground">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                <p className="text-xs font-bold uppercase tracking-widest">Cart is empty</p>
              </div>
            )}
          </div>

          {/* Customer & Payment */}
          <div className="space-y-4 pt-2 border-t border-border/50">
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name (Optional)"
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Touchable 
                onPress={() => setPaymentMethod('cash')}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-center",
                  paymentMethod === 'cash' ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-secondary border-transparent text-muted-foreground"
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest">Cash</p>
              </Touchable>
              <Touchable 
                onPress={() => setPaymentMethod('transfer')}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-center",
                  paymentMethod === 'transfer' ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-secondary border-transparent text-muted-foreground"
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest">Transfer</p>
              </Touchable>
              <Touchable 
                onPress={() => setPaymentMethod('credit')}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-center",
                  paymentMethod === 'credit' ? "bg-amber-50 border-amber-500 text-amber-700" : "bg-secondary border-transparent text-muted-foreground"
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest">Credit</p>
              </Touchable>
            </div>
          </div>

          {/* Summary & Submit */}
          <div className="pt-4 space-y-4">
            <div className="flex justify-between items-end px-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Amount</p>
              <p className="text-3xl font-bold tracking-tighter tabular-nums">₦{totalAmount.toLocaleString()}</p>
            </div>
            <Touchable 
              onPress={handleConfirm}
              disabled={cart.length === 0}
              className="w-full bg-primary text-white font-bold py-5 rounded-[24px] shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-50"
            >
              Confirm & Print Receipt
            </Touchable>
          </div>
        </div>
      </BottomSheet>

      <ReceiptSheet 
        transaction={lastTransaction}
        isOpen={!!lastTransaction}
        onClose={() => setLastTransaction(null)}
      />
    </>
  );
}
