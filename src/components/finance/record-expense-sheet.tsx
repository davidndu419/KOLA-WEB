// src/components/finance/record-expense-sheet.tsx
'use client';

import { useState } from 'react';
import { financeService } from '@/services/finance.service';
import { useStore } from '@/store/use-store';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Receipt, Tag, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationService } from '@/services/notificationService';

const categories = [
  'Rent', 'Utilities', 'Salary', 'Transport', 'Marketing', 'Maintenance', 'Others'
];

export function RecordExpenseSheet({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { business } = useStore();
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState('Others');
  const [note, setNote] = useState('');
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (amount <= 0 || !business) return;
    setIsSubmitting(true);
    
    try {
      await financeService.recordExpense({
        amount,
        category_id: category, // Using name as ID for now since we don't have a category table fully populated
        payment_method: payment_method,
        note,
      }, business.id);

      setAmount(0);
      setCategory('Others');
      setNote('');
      onClose();
      window.setTimeout(() => {
        notificationService.notifyTransaction('expense', `₦${amount.toLocaleString()}`);
      }, 0);
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Record Expense" 
      dismissible={false}
    >
      <div className="space-y-6 py-4 pb-2">
        <div className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₦</span>
            <input 
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Amount Spent"
              className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <Touchable 
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl border-2 transition-all text-[11px] font-bold uppercase tracking-wide",
                    category === cat ? "bg-red-50 border-red-500 text-red-700" : "bg-secondary border-transparent text-muted-foreground"
                  )}
                >
                  {cat}
                </Touchable>
              ))}
            </div>
          </div>

          <div className="relative">
            <Receipt size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Expense Note (Optional)"
              className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Touchable 
              onPress={() => setPaymentMethod('cash')}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-center",
                payment_method === 'cash' ? "bg-red-50 border-red-500 text-red-700" : "bg-secondary border-transparent text-muted-foreground"
              )}
            >
              <p className="text-xs font-bold uppercase tracking-widest">Cash</p>
            </Touchable>
            <Touchable 
              onPress={() => setPaymentMethod('transfer')}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-center",
                payment_method === 'transfer' ? "bg-red-50 border-red-500 text-red-700" : "bg-secondary border-transparent text-muted-foreground"
              )}
            >
              <p className="text-xs font-bold uppercase tracking-widest">Transfer</p>
            </Touchable>
          </div>
        </div>

        <Touchable 
          onPress={handleConfirm}
          disabled={amount <= 0 || isSubmitting}
          className="w-full bg-red-500 text-white font-bold py-5 rounded-[24px] shadow-xl shadow-red-500/20 flex items-center justify-center disabled:opacity-50"
        >
          {isSubmitting ? 'Recording...' : 'Record Expense'}
        </Touchable>
      </div>
    </BottomSheet>
  );
}
