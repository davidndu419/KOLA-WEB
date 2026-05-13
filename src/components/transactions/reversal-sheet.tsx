// src/components/transactions/reversal-sheet.tsx
'use client';

import { useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import type { Transaction } from '@/db/schema';
import { ReversalService } from '@/lib/services/reversal-service';

export function ReversalSheet({
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
  const [isReversing, setIsReversing] = useState(false);

  const handleReverse = async () => {
    if (!transaction || !reason.trim()) return;
    
    setIsReversing(true);
    try {
      await ReversalService.reverseTransaction(transaction.localId, reason, transaction.businessId);
      onSuccess();
      onClose();
      setReason('');
    } catch (error: any) {
      alert(error.message || 'Failed to reverse transaction');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Reverse Transaction" bottomOffset={64}>
      <div className="space-y-6 py-4 pb-10">
        <div className="bg-red-500/10 border border-red-500/20 rounded-[24px] p-5 flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-red-600">This action cannot be undone.</p>
            <p className="text-xs font-medium text-red-500/80 mt-1">
              Reversing will cancel the financial impact and restore any inventory items.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">
            Reason for Reversal
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Wrong quantity entered, Customer returned items..."
            className="w-full bg-secondary/50 border border-border rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-[100px]"
          />
        </div>

        <Touchable
          onPress={handleReverse}
          disabled={!reason.trim() || isReversing}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold shadow-xl transition-all ${
            reason.trim() && !isReversing 
              ? 'bg-red-500 text-white shadow-red-500/20' 
              : 'bg-secondary text-muted-foreground grayscale cursor-not-allowed'
          }`}
        >
          <RotateCcw size={18} className={isReversing ? 'animate-spin' : ''} />
          {isReversing ? 'Reversing...' : 'Confirm Reversal'}
        </Touchable>
      </div>
    </BottomSheet>
  );
}
