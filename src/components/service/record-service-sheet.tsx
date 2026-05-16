'use client';

import { useState, useEffect } from 'react';
import { financeService } from '@/services/finance.service';
import { useAuthStore } from '@/stores/authStore';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Briefcase, User, Zap, Coins, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createBaseEntity } from '@/db/dexie';
import { ServiceCategory } from '@/db/schema';
import { syncQueueService } from '@/services/syncQueueService';
import { notificationService } from '@/services/notificationService';

export function RecordServiceSheet({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const business = useAuthStore((state) => state.business);
  const businessId = business?.id || business?.business_id;

  const [serviceName, setServiceName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAmount, setIsManualAmount] = useState(false);
  
  // Quick Create State
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatPrice, setNewCatPrice] = useState('');

  const categories = useLiveQuery(
    () => businessId 
      ? db.service_categories
          .where('business_id')
          .equals(businessId)
          .filter(c => c.status === 'active')
          .toArray()
      : Promise.resolve([] as ServiceCategory[]),
    [businessId]
  ) || [];

  // Handle category selection and price autofill
  const handleCategorySelect = (categoryId: string) => {
    const cat = categories.find(c => c.local_id === categoryId || c.id?.toString() === categoryId);
    if (cat) {
      setSelectedCategoryId(cat.local_id);
      setSelectedCategoryName(cat.name);
      setServiceName(cat.name);
      
      // Update amount to the category's default price
      const price = Number(cat.default_price || 0);
      setAmount(price);
      setIsManualAmount(false);
    }
  };

  const handleConfirm = async () => {
    if (!serviceName || amount <= 0 || !businessId) return;
    setIsSubmitting(true);
    
    try {
      await financeService.recordService({
        name: serviceName,
        category_id: selectedCategoryId || undefined,
        category_name: selectedCategoryName || undefined,
        amount: amount,
        payment_method: payment_method,
        customer_id: payment_method === 'credit' ? 'walk-in-customer' : undefined,
        note: serviceName,
      }, businessId);

      resetForm();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setServiceName('');
    setSelectedCategoryId(null);
    setSelectedCategoryName(null);
    setAmount(0);
    setCustomerName('');
    setPaymentMethod('cash');
    setIsManualAmount(false);
  };

  const handleQuickCreate = async () => {
    if (!newCatName || !businessId) return;
    try {
      const price = newCatPrice ? Number(newCatPrice) : 0;
      const newCat: ServiceCategory = {
        ...createBaseEntity(businessId),
        name: newCatName,
        default_price: price,
        status: 'active',
      };
      await db.service_categories.add(newCat);
      await syncQueueService.enqueue('service_categories', 'create', newCat, businessId);
      
      // Auto-select the newly created category
      setSelectedCategoryId(newCat.local_id);
      setSelectedCategoryName(newCat.name);
      setServiceName(newCat.name);
      setAmount(price);
      setIsManualAmount(false);
      
      setNewCatName('');
      setNewCatPrice('');
      setIsQuickCreateOpen(false);
    } catch (error) {
      console.error('Failed to quick-create category:', error);
    }
  };

  return (
    <>
      <BottomSheet 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Record Service" 
        dismissible={false}
      >
        <div className="space-y-6 py-4 pb-2">
          <div className="space-y-5">
            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Service Category</label>
              <div className="flex flex-wrap gap-2 px-1">
                {categories.map(cat => (
                  <Touchable 
                    key={cat.local_id}
                    onPress={() => handleCategorySelect(cat.local_id)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2",
                      selectedCategoryId === cat.local_id 
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700" 
                        : "bg-secondary border-transparent text-muted-foreground/60"
                    )}
                  >
                    {selectedCategoryId === cat.local_id && <Check size={14} strokeWidth={3} />}
                    <span className="text-[11px] font-black uppercase tracking-wider">{cat.name}</span>
                  </Touchable>
                ))}
                <Touchable 
                  onPress={() => setIsQuickCreateOpen(true)}
                  className="px-4 py-2.5 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground/60 flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span className="text-[11px] font-black uppercase tracking-wider">Add New</span>
                </Touchable>
              </div>
            </div>

            {/* Service Name */}
            <div className="relative">
              <Zap size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="What service was rendered?"
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Amount */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">₦</span>
              <input 
                type="number"
                value={amount || ''}
                onChange={(e) => {
                  setAmount(Number(e.target.value));
                  setIsManualAmount(true);
                }}
                placeholder="Amount Charged"
                className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
              />
            </div>

            {/* Customer (Optional) */}
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name (Optional)"
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'transfer', 'credit'] as const).map((method) => (
                <Touchable 
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={cn(
                    "p-3 rounded-2xl border-2 transition-all text-center",
                    payment_method === method 
                      ? "bg-indigo-50 border-indigo-500 text-indigo-700" 
                      : "bg-secondary border-transparent text-muted-foreground/40"
                  )}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.15em]">{method}</p>
                </Touchable>
              ))}
            </div>
          </div>

          <Touchable 
            onPress={handleConfirm}
            disabled={!serviceName || amount <= 0 || isSubmitting}
            className={cn(
              "w-full font-black py-5 rounded-[24px] shadow-xl flex items-center justify-center transition-all active:scale-[0.98]",
              !serviceName || amount <= 0 || isSubmitting
                ? "bg-muted text-muted-foreground"
                : "bg-indigo-600 text-white shadow-indigo-500/20"
            )}
          >
            {isSubmitting ? 'Recording...' : 'Complete Service'}
          </Touchable>
        </div>
      </BottomSheet>

      {/* Quick Create Category Sheet */}
      <BottomSheet
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        title="New Category"
      >
        <div className="space-y-6 py-6 pb-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Category Name</label>
            <input 
              type="text"
              placeholder="e.g. Haircut, Consulting"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Default Price (Optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">₦</span>
              <input 
                type="number"
                placeholder="0.00"
                value={newCatPrice}
                onChange={e => setNewCatPrice(e.target.value)}
                className="w-full bg-secondary py-4 pl-10 pr-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <Touchable 
            onPress={handleQuickCreate}
            disabled={!newCatName}
            className={cn(
              "w-full p-5 rounded-2xl font-black text-center shadow-lg transition-all",
              newCatName ? "bg-primary text-white shadow-primary/20" : "bg-muted text-muted-foreground"
            )}
          >
            Create Category
          </Touchable>
        </div>
      </BottomSheet>
    </>
  );
}
