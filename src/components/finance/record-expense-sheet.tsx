// src/components/finance/record-expense-sheet.tsx
'use client';

import { useState } from 'react';
import { financeService } from '@/services/finance.service';
import { useAuthStore } from '@/stores/authStore';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Check, Plus, Receipt, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationService } from '@/services/notificationService';
import { db, createBaseEntity } from '@/db/dexie';
import { ExpenseCategory } from '@/db/schema';
import { syncQueueService } from '@/services/syncQueueService';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';

export function RecordExpenseSheet({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const business = useAuthStore((state) => state.business);
  const businessId = business?.id || business?.business_id;

  const [amount, setAmount] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatAmount, setNewCatAmount] = useState('');

  const categories = useStableLiveQuery<ExpenseCategory[]>(
    () => businessId
      ? db.expense_categories
          .where('business_id')
          .equals(businessId)
          .filter((category) => category.status === 'active')
          .toArray()
      : undefined,
    [businessId],
    []
  ) || [];

  const handleCategorySelect = (categoryId: string) => {
    const category = categories.find((item) => item.local_id === categoryId || item.id?.toString() === categoryId);
    if (!category) return;

    setSelectedCategoryId(category.local_id);
    setSelectedCategoryName(category.name);
    setAmount(Number(category.default_amount || 0));
  };

  const resetForm = () => {
    setAmount(0);
    setSelectedCategoryId(null);
    setSelectedCategoryName(null);
    setNote('');
    setPaymentMethod('cash');
  };

  const handleConfirm = async () => {
    if (amount <= 0 || !businessId || !selectedCategoryId || !selectedCategoryName) return;
    setIsSubmitting(true);

    try {
      await financeService.recordExpense({
        amount,
        category_id: selectedCategoryId,
        category_name: selectedCategoryName,
        payment_method,
        note,
      }, businessId);

      const recordedAmount = amount;
      resetForm();
      onClose();
      window.setTimeout(() => {
        notificationService.notifyTransaction('expense', `NGN ${recordedAmount.toLocaleString()}`);
      }, 0);
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickCreate = async () => {
    if (!newCatName.trim() || !businessId) return;

    try {
      const defaultAmount = newCatAmount ? Number(newCatAmount) : 0;
      const category: ExpenseCategory = {
        ...createBaseEntity(businessId),
        name: newCatName.trim(),
        default_amount: defaultAmount,
        status: 'active',
      };

      await db.expense_categories.add(category);
      await syncQueueService.enqueue('expense_categories', 'create', category, businessId);

      setSelectedCategoryId(category.local_id);
      setSelectedCategoryName(category.name);
      setAmount(defaultAmount);
      setNewCatName('');
      setNewCatAmount('');
      setIsQuickCreateOpen(false);
    } catch (error) {
      console.error('Failed to quick-create expense category:', error);
      alert('Failed to create expense category');
    }
  };

  const canSubmit = amount > 0 && Boolean(selectedCategoryId) && Boolean(selectedCategoryName) && !isSubmitting;

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Record Expense"
        dismissible={false}
      >
        <div className="space-y-6 py-4 pb-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Expense Category</label>
              <div className="flex flex-wrap gap-2 px-1">
                {categories.map((category) => (
                  <Touchable
                    key={category.local_id}
                    onPress={() => handleCategorySelect(category.local_id)}
                    className={cn(
                      'px-4 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2',
                      selectedCategoryId === category.local_id
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-secondary border-transparent text-muted-foreground/60'
                    )}
                  >
                    {selectedCategoryId === category.local_id && <Check size={14} strokeWidth={3} />}
                    <span className="text-[11px] font-black uppercase tracking-wider">{category.name}</span>
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
              {categories.length === 0 && (
                <p className="px-2 text-[11px] font-bold text-muted-foreground">
                  Create a category to record this expense.
                </p>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">NGN</span>
              <input
                type="number"
                value={amount || ''}
                onChange={(event) => setAmount(Number(event.target.value))}
                placeholder="Amount Spent"
                className="w-full bg-secondary rounded-2xl p-4 pl-14 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500 tabular-nums"
              />
            </div>

            <div className="relative">
              <Receipt size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Expense Note (Optional)"
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {(['cash', 'transfer'] as const).map((method) => (
                <Touchable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={cn(
                    'p-4 rounded-2xl border-2 transition-all text-center',
                    payment_method === method
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-secondary border-transparent text-muted-foreground'
                  )}
                >
                  <p className="text-xs font-bold uppercase tracking-widest">{method}</p>
                </Touchable>
              ))}
            </div>
          </div>

          <Touchable
            onPress={handleConfirm}
            disabled={!canSubmit}
            className={cn(
              'w-full font-bold py-5 rounded-[24px] shadow-xl flex items-center justify-center transition-all active:scale-[0.98]',
              canSubmit
                ? 'bg-red-500 text-white shadow-red-500/20'
                : 'bg-muted text-muted-foreground shadow-none'
            )}
          >
            {isSubmitting ? 'Recording...' : 'Record Expense'}
          </Touchable>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        title="New Expense Category"
      >
        <div className="space-y-6 py-6 pb-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Category Name</label>
            <div className="relative">
              <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g. Transport, Utilities"
                value={newCatName}
                onChange={(event) => setNewCatName(event.target.value)}
                className="w-full bg-secondary p-4 pl-12 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Default Amount (Optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">NGN</span>
              <input
                type="number"
                placeholder="0.00"
                value={newCatAmount}
                onChange={(event) => setNewCatAmount(event.target.value)}
                className="w-full bg-secondary py-4 pl-14 pr-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <Touchable
            onPress={handleQuickCreate}
            disabled={!newCatName.trim()}
            className={cn(
              'w-full p-5 rounded-2xl font-black text-center shadow-lg transition-all',
              newCatName.trim() ? 'bg-primary text-white shadow-primary/20' : 'bg-muted text-muted-foreground'
            )}
          >
            Create Category
          </Touchable>
        </div>
      </BottomSheet>
    </>
  );
}
