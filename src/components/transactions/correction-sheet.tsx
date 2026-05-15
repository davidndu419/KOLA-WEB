// src/components/transactions/correction-sheet.tsx
'use client';
import { useStore } from '@/store/use-store';
import { useState, useEffect } from 'react';
import { Edit3, AlertCircle, ShoppingBag, User, Plus, Minus, X, Search } from 'lucide-react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import type { Transaction } from '@/db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { correctionService } from '@/services/correctionService';
import { cn } from '@/lib/utils';


export function CorrectionSheet({
  transaction,
  isOpen,
  onClose,
  onSuccess
}: {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const { user } = useStore();
  // State for Sales Correction
  const [cart, setCart] = useState<{ product_id: string; name: string; quantity: number; price: number }[]>([]);
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State for Expense/Service Correction
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (transaction) {
      setReason('');
      setPaymentMethod(transaction.payment_method);
      setAmount(transaction.amount);
      setNote(transaction.note || '');
      
      if (transaction.type === 'sale' && transaction.reference_id) {
        // We need to fetch product names for the cart display
        const loadCart = async () => {
          const saleItems = await db.sale_items.where('sale_id').equals(transaction.reference_id).toArray();
          const itemsWithNames = await Promise.all(
            saleItems.map(async (item) => {
              const product = await db.products.where('local_id').equals(item.product_id).first();
              return {
                product_id: item.product_id,
                name: product?.name || 'Unknown Product',
                quantity: item.quantity,
                price: item.unit_price
              };
            })
          );
          setCart(itemsWithNames);
        };
        loadCart();
      }
    }
  }, [transaction]);

  const products = useLiveQuery(async () => {
    if (!searchQuery) return [];
    return await db.products
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.is_archived)
      .limit(5)
      .toArray();
  }, [searchQuery]);

  const handleCorrect = async () => {
    if (!transaction || !reason.trim()) return;
    
    setIsCorrecting(true);
    try {
      let updatedData: Partial<Transaction> = {
        payment_method: payment_method,
        note
      };

      if (transaction.type === 'sale') {
        updatedData.amount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      } else {
        updatedData.amount = amount;
      }

      await correctionService.correctTransaction(transaction.local_id, updatedData, reason, transaction.business_id);
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to correct transaction');
    } finally {
      setIsCorrecting(false);
    }
  };


  const total_amount = transaction?.type === 'sale' 
    ? cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    : amount;

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Correct ${transaction?.type || 'Transaction'}`} 
      dismissible={false}
    >
      <div className="space-y-6 py-4 pb-2">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[24px] p-4 flex gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider leading-relaxed">
            CORRECTION MODE: The original record will be preserved for auditing. Changes will be recorded as a new version.
          </p>
        </div>

        {transaction?.type === 'sale' && (
          <div className="space-y-6">
            {/* Sales Correction UI (Simplified from RecordSaleSheet) */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Replace or add products..."
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
              />
              {searchQuery && products && products.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-card border border-border mt-2 rounded-2xl shadow-xl z-50 overflow-hidden">
                  {products.map(p => (
                    <button 
                      key={p.local_id}
                      onClick={() => {
                        setCart(prev => {
                          const existing = prev.find(item => item.product_id === p.local_id);
                          if (existing) return prev.map(item => item.product_id === p.local_id ? { ...item, quantity: item.quantity + 1 } : item);
                          return [...prev, { product_id: p.local_id, name: p.name, quantity: 1, price: p.selling_price }];
                        });
                        setSearchQuery('');
                      }}
                      className="w-full p-4 text-left hover:bg-secondary flex justify-between items-center transition-colors border-b border-border last:border-0"
                    >
                      <div>
                        <p className="font-bold text-sm">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{p.stock} in stock</p>
                      </div>
                      <p className="font-bold text-primary">₦{p.selling_price.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.product_id} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                  <div className="flex-1">
                    <p className="font-bold text-sm">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground font-bold">₦{item.price.toLocaleString()} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Touchable 
                      onPress={() => setCart(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                      className="w-8 h-8 rounded-lg bg-card flex items-center justify-center border border-border"
                    >
                      <Minus size={14} />
                    </Touchable>
                    <span className="font-bold tabular-nums">{item.quantity}</span>
                    <Touchable 
                      onPress={() => setCart(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="w-8 h-8 rounded-lg bg-card flex items-center justify-center border border-border"
                    >
                      <Plus size={14} />
                    </Touchable>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(transaction?.type === 'expense' || transaction?.type === 'service') && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Amount</label>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-secondary rounded-2xl p-4 text-2xl font-bold outline-none tabular-nums"
              />
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'transfer', 'credit'] as const).map(m => (
              <Touchable 
                key={m}
                onPress={() => setPaymentMethod(m)}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-center capitalize",
                  payment_method === m ? "bg-primary/5 border-primary text-primary" : "bg-secondary border-transparent text-muted-foreground"
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest">{m}</p>
              </Touchable>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Reason for Correction</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you making this change?"
              className="w-full bg-secondary/50 border border-border rounded-2xl p-4 text-sm font-medium focus:outline-none min-h-[80px]"
            />
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <div className="flex justify-between items-end px-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">New Total</p>
            <p className="text-3xl font-bold tracking-tighter tabular-nums">₦{total_amount.toLocaleString()}</p>
          </div>
          <Touchable 
            onPress={handleCorrect}
            disabled={!reason.trim() || isCorrecting}
            className="w-full bg-amber-500 text-white font-bold py-5 rounded-[24px] shadow-xl shadow-amber-500/20 flex items-center justify-center disabled:opacity-50"
          >
            <Edit3 size={18} className="mr-2" />
            {isCorrecting ? 'Applying Changes...' : 'Apply Correction'}
          </Touchable>
        </div>
      </div>
    </BottomSheet>
  );
}
