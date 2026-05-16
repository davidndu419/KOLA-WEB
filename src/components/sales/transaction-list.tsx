// src/components/sales/transaction-list.tsx
'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Receipt, Zap, History } from 'lucide-react';
import { db } from '@/db/dexie';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { TransactionRow } from '@/components/transactions/transaction-row';
import type { Transaction } from '@/db/schema';

import { ReversalSheet } from '@/components/transactions/reversal-sheet';
import { CorrectionSheet } from '@/components/transactions/correction-sheet';
import { AuditTrailSheet } from '@/components/transactions/audit-trail-sheet';
import { useAuthStore } from '@/stores/authStore';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';
import { enrichTransactionsForDisplay, filterTransactionsForSearch, type DisplayTransaction } from '@/services/transactionDisplay';

interface TransactionListProps {
  startDate?: Date;
  endDate?: Date;
  type?: Transaction['type'] | 'all';
  limit?: number;
  transactions?: Transaction[];
  searchQuery?: string;
  onCountChange?: (count: number) => void;
}

function getEmptyState(type: TransactionListProps['type']) {
  const states = {
    service: {
      icon: Zap,
      title: 'No Services Yet',
      message: 'Record your first professional service to track earnings here.'
    },
    expense: {
      icon: Receipt,
      title: 'Zero Expenses',
      message: 'Track your business spending to manage your cash flow better.'
    },
    sale: {
      icon: ShoppingBag,
      title: 'No Sales Recorded',
      message: 'Every sale you record helps build your business intelligence.'
    },
    all: {
      icon: History,
      title: 'Clean Slate',
      message: 'Your business activity timeline will appear here automatically.'
    }
  };

  return (states as any)[type || 'all'] || states.all;
}

export function TransactionList({ startDate, endDate, type = 'all', limit, transactions, searchQuery, onCountChange }: TransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<DisplayTransaction | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const businessId = useAuthStore((state) => state.activeBusinessId);

  const transactionsQuery = useStableLiveQuery(async () => {
    if (!businessId && !transactions) return undefined;

    const applyTypeFilter = (items: Transaction[]) => (
      type === 'all' ? items : items.filter((tx) => tx.type === type)
    );

    let source: Transaction[];
    if (transactions) {
      source = transactions;
    } else {
      let query: any;

      if (startDate && endDate) {
        query = db.transactions
          .where('created_at')
          .between(startDate, endDate)
          .reverse();
      } else {
        query = db.transactions.orderBy('created_at').reverse();
      }

      source = await query.toArray();
    }

    const filtered = applyTypeFilter(source.filter((tx: Transaction) => (!businessId || tx.business_id === businessId) && !tx.deleted_at));
    const enriched = await enrichTransactionsForDisplay(filtered);
    const searched = filterTransactionsForSearch(enriched, searchQuery);
    
    return limit ? searched.slice(0, limit) : searched;
  }, [businessId, startDate, endDate, type, limit, transactions, searchQuery]);

  const displayTransactions = transactionsQuery;
  const isSearching = Boolean(searchQuery?.trim());

  useEffect(() => {
    if (displayTransactions) {
      onCountChange?.(displayTransactions.length);
    }
  }, [displayTransactions, onCountChange]);

  if (!displayTransactions) {
    return (
      <div className="space-y-4 pt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 bg-secondary rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-secondary rounded w-1/3" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
            <div className="w-16 h-5 bg-secondary rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (displayTransactions.length === 0) {
    const empty = isSearching ? {
      icon: History,
      title: 'No results found',
      message: 'Try another product, amount, customer, category, or payment method.'
    } : getEmptyState(type);
    const EmptyIcon = empty.icon;
    
    return (
      <div className="py-20 px-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-secondary/50 rounded-[32px] flex items-center justify-center text-muted-foreground/40 mb-6 border-2 border-dashed border-border/50">
          <EmptyIcon size={32} strokeWidth={1.5} />
        </div>
        <h3 className="font-black text-lg tracking-tight mb-2">{empty.title}</h3>
        <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed font-medium">
          {empty.message}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-border/30">
        {displayTransactions.map((tx) => (
          <TransactionRow
            key={tx.local_id}
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
        transaction_id={selectedTransaction?.local_id || null}
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
      />
    </>
  );
}
