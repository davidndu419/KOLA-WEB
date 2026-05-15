'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { salesService } from '@/services/sales.service';
import { useStore } from '@/store/use-store';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { 
  Search, 
  ShoppingBag, 
  User, 
  Plus, 
  Minus, 
  X, 
  ChevronRight, 
  ArrowLeft, 
  Check, 
  AlertCircle,
  TrendingUp,
  History,
  ShoppingCart,
  Trash2,
  Package
} from 'lucide-react';
import { ReceiptSheet } from './receipt-sheet';
import { cn } from '@/lib/utils';
import { Transaction, Product, TransactionWithItems } from '@/db/schema';
import { AnimatePresence, motion } from 'framer-motion';
import { notificationService } from '@/services/notificationService';

type CartItem = {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  original_price: number;
  cost: number;
  stock: number;
  unit_type: string;
};

export function RecordSaleSheet({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { business } = useStore();
  const [step, setStep] = useState<'selection' | 'checkout'>('selection');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [lastTransaction, setLastTransaction] = useState<TransactionWithItems | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setStep('selection');
        setCart([]);
        setSearchQuery('');
        setPaymentMethod('cash');
        setCustomerName('');
        setEditingPriceId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Smart Sorting Data
  const sortingData = useLiveQuery(async () => {
    const items = await db.sale_items.toArray();
    const counts: Record<string, number> = {};
    
    items.forEach(item => {
      counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
    });

    const topIds = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);

    const recentSales = await db.sales.orderBy('created_at').reverse().limit(10).toArray();
    const recentSaleIds = recentSales.map(s => s.local_id);
    const recentItems = await db.sale_items.where('sale_id').anyOf(recentSaleIds).toArray();
    const recentIds = Array.from(new Set(recentItems.map(i => i.product_id))).slice(0, 10);

    return { topIds, recentIds };
  }, []);

  // Products List with Smart Sorting & Search
  const products = useLiveQuery(async () => {
    const allProducts = await db.products.filter(p => !p.is_archived && !p.deleted_at).toArray();
    
    let filtered = allProducts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => {
      // 1. Priority: Search match (exact match first)
      if (searchQuery) {
        const aExact = a.name.toLowerCase() === searchQuery.toLowerCase();
        const bExact = b.name.toLowerCase() === searchQuery.toLowerCase();
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;
      }

      // 2. Priority: Top Sold
      const aTop = sortingData?.topIds.indexOf(a.local_id) ?? -1;
      const bTop = sortingData?.topIds.indexOf(b.local_id) ?? -1;
      if (aTop !== -1 && bTop === -1) return -1;
      if (bTop !== -1 && aTop === -1) return 1;
      if (aTop !== -1 && bTop !== -1) return aTop - bTop;

      // 3. Priority: Recently Sold
      const aRecent = sortingData?.recentIds.indexOf(a.local_id) ?? -1;
      const bRecent = sortingData?.recentIds.indexOf(b.local_id) ?? -1;
      if (aRecent !== -1 && bRecent === -1) return -1;
      if (bRecent !== -1 && aRecent === -1) return 1;

      // 4. Priority: Stock availability
      if (a.stock > 0 && b.stock <= 0) return -1;
      if (b.stock > 0 && a.stock <= 0) return 1;

      // 5. Fallback: Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, sortingData]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.local_id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.product_id === product.local_id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { 
        product_id: product.local_id, 
        name: product.name, 
        quantity: 1, 
        price: product.selling_price, 
        original_price: product.selling_price,
        cost: product.buying_price,
        stock: product.stock,
        unit_type: product.unit_type
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.product_id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.product_id !== productId);
    });
  };

  const clearItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const updatePrice = (productId: string, newPrice: number) => {
    setCart(prev => prev.map(item => item.product_id === productId ? { ...item, price: newPrice } : item));
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleConfirm = async () => {
    if (cart.length === 0 || !business) return;
    
    try {
      const result = await salesService.recordSale({
        total_amount: totalAmount,
        discount_amount: 0,
        tax_amount: 0,
        net_amount: totalAmount,
        payment_method: payment_method,
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          cost: item.cost
        })),
        customer_id: payment_method === 'credit' ? 'walk-in-customer' : undefined,
        note: customerName ? `Customer: ${customerName}` : undefined
      }, business.id);

      // Attach items for receipt
      const transactionWithItems: TransactionWithItems = {
        ...result.transaction,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))
      };

      setLastTransaction(transactionWithItems);
      notificationService.notifyTransaction('sale', `₦${totalAmount.toLocaleString()}`);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record sale');
    }
  };

  return (
    <>
      <BottomSheet 
        isOpen={isOpen} 
        onClose={onClose} 
        title={step === 'selection' ? "Point of Sale" : "Review Checkout"} 
        dismissible={step === 'selection'}
      >
        <div className="flex flex-col min-h-[450px] max-h-[85vh]">
          <AnimatePresence mode="wait">
            {step === 'selection' ? (
              <motion.div 
                key="selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col space-y-4"
              >
                {/* Search */}
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product or SKU..."
                    className="w-full bg-secondary rounded-[24px] p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>

                {/* Product List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-none min-h-[300px]">
                  {products?.map(product => {
                    const cartItem = cart.find(i => i.product_id === product.local_id);
                    const isTop = sortingData?.topIds.includes(product.local_id);
                    const isRecent = sortingData?.recentIds.includes(product.local_id);
                    
                    return (
                      <div 
                        key={product.local_id}
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-[28px] border transition-all active:scale-[0.98]",
                          cartItem ? "bg-primary/5 border-primary/20" : "bg-card border-border/50"
                        )}
                      >
                        <div className="flex-1 min-w-0" onClick={() => addToCart(product)}>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm truncate">{product.name}</p>
                            {isTop && <TrendingUp size={12} className="text-emerald-500" />}
                            {isRecent && !isTop && <History size={12} className="text-blue-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs font-black text-primary">₦{product.selling_price.toLocaleString()}</p>
                            <span className="text-[10px] text-muted-foreground/30 font-bold">•</span>
                            <p className={cn(
                              "text-[10px] font-bold uppercase",
                              product.stock <= product.min_stock ? "text-red-500" : "text-muted-foreground/60"
                            )}>
                              {product.stock} in stock
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {cartItem ? (
                            <div className="flex items-center bg-white rounded-2xl p-1 shadow-sm border border-border/50">
                              <Touchable 
                                onPress={() => removeFromCart(product.local_id)}
                                className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center"
                              >
                                <Minus size={14} />
                              </Touchable>
                              <span className="w-8 text-center font-black text-xs tabular-nums">{cartItem.quantity}</span>
                              <Touchable 
                                onPress={() => addToCart(product)}
                                className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center"
                                disabled={cartItem.quantity >= product.stock}
                              >
                                <Plus size={14} />
                              </Touchable>
                            </div>
                          ) : (
                            <Touchable 
                              onPress={() => addToCart(product)}
                              className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center text-primary"
                              disabled={product.stock <= 0}
                            >
                              <Plus size={20} />
                            </Touchable>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sticky Footer */}
                {cart.length > 0 && (
                  <motion.div 
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="pt-2"
                  >
                    <Touchable 
                      onPress={() => setStep('checkout')}
                      className="w-full bg-primary text-white p-5 rounded-[28px] shadow-2xl shadow-primary/30 flex items-center justify-between group overflow-hidden relative"
                    >
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="bg-white/20 px-3 py-1 rounded-xl font-black text-sm">
                          {cartCount} {cartCount === 1 ? 'item' : 'items'}
                        </div>
                        <span className="font-bold text-sm tracking-tight">Checkout Now</span>
                      </div>
                      <div className="flex items-center gap-3 relative z-10">
                        <span className="font-black text-xl">₦{totalAmount.toLocaleString()}</span>
                        <ChevronRight size={20} />
                      </div>
                    </Touchable>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="checkout"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col space-y-6"
              >
                {/* Back Button */}
                <div className="flex items-center gap-4">
                  <Touchable 
                    onPress={() => setStep('selection')}
                    className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center"
                  >
                    <ArrowLeft size={18} />
                  </Touchable>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Review Cart</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{cartCount} items selected</p>
                  </div>
                </div>

                {/* Cart Review List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
                  {cart.map(item => (
                    <div key={item.product_id} className="bg-secondary/30 rounded-[32px] p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{item.name}</p>
                          <p className="text-[10px] font-black text-muted-foreground uppercase mt-0.5">{item.quantity} x ₦{item.price.toLocaleString()}</p>
                        </div>
                        <button onClick={() => clearItem(item.product_id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex items-end justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Selling Price</p>
                          <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-primary select-none">₦</span>
                            <input 
                              type="number"
                              value={item.price}
                              onChange={(e) => updatePrice(item.product_id, Number(e.target.value))}
                              className="w-full bg-white border-2 border-border/10 focus:border-primary/30 rounded-2xl py-4 pl-10 pr-4 text-base font-black outline-none transition-all shadow-sm tabular-nums"
                            />
                            {item.price !== item.original_price && (
                              <div className="flex items-center gap-1.5 mt-2 ml-1">
                                <AlertCircle size={12} className={item.price < item.original_price ? "text-amber-500" : "text-blue-500"} />
                                <p className={cn(
                                  "text-[10px] font-bold uppercase",
                                  item.price < item.original_price ? "text-amber-600" : "text-blue-600"
                                )}>
                                  {item.price < item.original_price ? "Below default price" : "Above default price"}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right pb-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Subtotal</p>
                          <p className="text-lg font-black tracking-tighter tabular-nums">₦{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer & Payment */}
                <div className="space-y-4 pt-2">
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name (Optional)"
                      className="w-full bg-secondary rounded-[24px] p-4 pl-12 text-sm font-bold outline-none border-2 border-transparent focus:border-primary/20 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'transfer', 'credit'] as const).map(method => (
                      <Touchable 
                        key={method}
                        onPress={() => setPaymentMethod(method)}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all text-center group",
                          payment_method === method 
                            ? "bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                            : "bg-secondary border-transparent text-muted-foreground"
                        )}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest">{method}</p>
                      </Touchable>
                    ))}
                  </div>
                </div>

                {/* Complete Sale Button */}
                <div className="pt-2">
                  <Touchable 
                    onPress={handleConfirm}
                    className="w-full bg-primary text-white p-5 rounded-[28px] shadow-2xl shadow-primary/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Check size={24} strokeWidth={3} />
                      <span className="font-bold text-lg">Complete Sale</span>
                    </div>
                    <span className="font-black text-2xl tracking-tighter">₦{totalAmount.toLocaleString()}</span>
                  </Touchable>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
