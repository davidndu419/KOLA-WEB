// src/components/sales/transaction-list.tsx
'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingBag } from 'lucide-react';
import { db } from '@/db/dexie';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { TransactionRow } from '@/components/transactions/transaction-row';
import type { Transaction } from '@/db/schema';

import { ReversalSheet } from '@/components/transactions/reversal-sheet';
import { CorrectionSheet } from '@/components/transactions/correction-sheet';
import { AuditTrailSheet } from '@/components/transactions/audit-trail-sheet';

interface TransactionListProps {
  startDate?: Date;
  endDate?: Date;
  type?: Transaction['type'] | 'all';
}

function emptyTitle(type: TransactionListProps['type']) {
  if (type === 'service') return 'No Services Yet';
  if (type === 'expense') return 'No Expenses Yet';
  return 'No Sales Yet';
}

export function TransactionList({ startDate, endDate, type = 'all' }: TransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);

  const transactions = useLiveQuery(async () => {
    const applyTypeFilter = (items: Transaction[]) => (
      type === 'all' ? items : items.filter((tx) => tx.type === type)
    );

    if (startDate && endDate) {
      const rangeItems = await db.transactions
        .where('createdAt')
        .between(startDate, endDate)
        .reverse()
        .toArray();
      return applyTypeFilter(rangeItems);
    }

    const allItems = await db.transactions.orderBy('createdAt').reverse().toArray();
    return applyTypeFilter(allItems);
  }, [startDate, endDate, type]);

  if (!transactions) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading Transactions...</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-card p-10 rounded-[28px] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <ShoppingBag size={28} />
        </div>
        <div>
          <h3 className="font-bold text-lg">{emptyTitle(type)}</h3>
          <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
            Your {type === 'all' ? 'transaction' : type} history will appear here once you record the first one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5 pb-32">
        {transactions.map((tx) => (
          <TransactionRow
            key={tx.localId}
            transaction={tx}
            onPress={() => setSelectedTransaction(tx)}
          />
        ))}
      </div>
      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onReverse={() => setIsReversalOpen(true)}
        onCorrect={() => setIsCorrectionOpen(true)}
        onViewAuditTrail={() => setIsAuditTrailOpen(true)}
      />

      <ReversalSheet 
        transaction={selectedTransaction}
        isOpen={isReversalOpen}
        onClose={() => setIsReversalOpen(false)}
        onSuccess={() => setSelectedTransaction(null)}
      />

      <CorrectionSheet
        transaction={selectedTransaction}
        isOpen={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        onSuccess={() => setSelectedTransaction(null)}
      />

      <AuditTrailSheet 
        transactionId={selectedTransaction?.localId || null}
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
      />
    </>
  );
}
