'use client';

import { useState } from 'react';
import { financeService } from '@/services/finance.service';
import { useStore } from '@/store/use-store';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Briefcase, User, Zap, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RecordServiceSheet({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { business } = useStore();
  const [serviceName, setServiceName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!serviceName || amount <= 0 || !business) return;
    setIsSubmitting(true);
    
    try {
      await financeService.recordService({
        name: serviceName,
        amount: amount,
        payment_method: payment_method,
        customer_id: payment_method === 'credit' ? 'walk-in-customer' : undefined,
        note: serviceName,
      }, business.id);


      setServiceName('');
      setAmount(0);
      setCustomerName('');
      alert('Service recorded successfully!');
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to record service');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Record Service" bottomOffset={64}>
      <div className="space-y-6 py-4 pb-10">
        <div className="space-y-4">
          <div className="relative">
            <Zap size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="What service was rendered?"
              className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₦</span>
            <input 
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Amount Charged"
              className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="relative">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name (Optional)"
              className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Touchable 
              onPress={() => setPaymentMethod('cash')}
              className={cn(
                "p-3 rounded-2xl border-2 transition-all text-center",
                payment_method === 'cash' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-secondary border-transparent text-muted-foreground"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest">Cash</p>
            </Touchable>
            <Touchable 
              onPress={() => setPaymentMethod('transfer')}
              className={cn(
                "p-3 rounded-2xl border-2 transition-all text-center",
                payment_method === 'transfer' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-secondary border-transparent text-muted-foreground"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest">Transfer</p>
            </Touchable>
            <Touchable 
              onPress={() => setPaymentMethod('credit')}
              className={cn(
                "p-3 rounded-2xl border-2 transition-all text-center",
                payment_method === 'credit' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-secondary border-transparent text-muted-foreground"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest">Credit</p>
            </Touchable>
          </div>
        </div>

        <Touchable 
          onPress={handleConfirm}
          disabled={!serviceName || amount <= 0 || isSubmitting}
          className="w-full bg-indigo-600 text-white font-bold py-5 rounded-[24px] shadow-xl shadow-indigo-500/20 flex items-center justify-center disabled:opacity-50"
        >
          {isSubmitting ? 'Recording...' : 'Complete Service'}
        </Touchable>
      </div>
    </BottomSheet>
  );
}
