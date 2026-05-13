'use client';

import { ShoppingBag, Receipt, Zap } from 'lucide-react';
import { Touchable } from '@/components/touchable';
import { TransactionAmount } from '@/components/typography';
import type { Transaction } from '@/db/schema';

export function formatTransactionListStamp(date: Date) {
  return `${date.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
  })} | ${date.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function TransactionRow({
  transaction,
  onPress,
}: {
  transaction: Transaction;
  onPress: () => void;
}) {
  const tx = transaction;

  return (
    <Touchable onPress={onPress} className="w-full text-left">
      <div className="flex items-center justify-between p-3 bg-card border border-border/60 shadow-md shadow-black/5 rounded-[22px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            tx.type === 'sale' ? 'bg-emerald-100 text-emerald-600' :
            tx.type === 'service' ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'
          }`}>
            {tx.type === 'sale' ? <ShoppingBag size={17} /> :
             tx.type === 'service' ? <Zap size={17} /> : <Receipt size={17} />}
          </div>
          <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-bold text-sm tracking-tight capitalize truncate">
                    {tx.type === 'reversal' ? 'Reversal' : tx.type} {tx.customer ? `• ${tx.customer}` : ''}
                  </p>
                  {tx.isEdited && (
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
                      Edited
                    </span>
                  )}
                  {tx.isReversed && (
                    <span className="bg-red-100 text-red-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
                      Reversed
                    </span>
                  )}
                  {tx.paymentMethod === 'credit' && (
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
                      Credit
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide truncate">
                  {formatTransactionListStamp(tx.createdAt)}
                  {tx.isReversed && ` • Reversed ${tx.reversalReason ? `(${tx.reversalReason})` : ''}`}
                </p>
          </div>
        </div>
        <TransactionAmount
          amount={tx.amount}
          type={tx.type === 'expense' ? 'expense' : 'income'}
          className="text-base flex-shrink-0"
        />
      </div>
    </Touchable>
  );
}
