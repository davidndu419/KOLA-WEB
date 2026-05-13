'use client';

import { useState } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeroBalanceCard } from '@/components/dashboard/hero-balance-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { CompactMetricCard, MetricGrid } from '@/components/reports/report-cards';
import { RecordSaleSheet } from '@/components/sales/record-sale-sheet';
import { RecordExpenseSheet } from '@/components/finance/record-expense-sheet';
import { Touchable } from '@/components/touchable';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { TransactionRow } from '@/components/transactions/transaction-row';
import { db } from '@/db/dexie';
import { resolveReportDateRange } from '@/services/reportSelectors';
import { reportsService } from '@/services/reportsService';
import type { Transaction } from '@/db/schema';
import { ReversalSheet } from '@/components/transactions/reversal-sheet';
import { CorrectionSheet } from '@/components/transactions/correction-sheet';
import { AuditTrailSheet } from '@/components/transactions/audit-trail-sheet';

export default function DashboardPage() {
  const [isSaleSheetOpen, setIsSaleSheetOpen] = useState(false);
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('createdAt').reverse().limit(5).toArray()
  );

  const reportsSnapshot = useLiveQuery(
    () => reportsService.getSnapshot(selectedRange, customDate),
    [selectedRange, customDate]
  );

  const stats = useLiveQuery(async () => {
    const { startDate, endDate } = resolveReportDateRange(selectedRange, customDate);

    const allLedger = await db.ledger_entries
      .where('accountName')
      .anyOf(['Cash', 'Bank', 'Receivables'])
      .toArray();
    const totalBalance = allLedger.reduce((acc, entry) => acc + (entry.debit - entry.credit), 0);

    const rangeTxs = await db.transactions
      .where('createdAt')
      .between(startDate, endDate)
      .and(tx => tx.status !== 'reversed') // Exclude reversed
      .toArray();
    
    const rangeRevenue = rangeTxs
      .filter((tx) => tx.type === 'sale' || tx.type === 'service')
      .reduce((acc, tx) => acc + tx.amount, 0);
    const rangeExpenses = rangeTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);
      
    const rangeLedger = await db.ledger_entries
      .where('createdAt')
      .between(startDate, endDate)
      .and((entry) => entry.accountName === 'COGS')
      .toArray();
    const rangeCOGS = rangeLedger.reduce((acc, entry) => acc + (entry.debit - entry.credit), 0);
    const rangeProfit = rangeRevenue - rangeCOGS - rangeExpenses;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthTxs = await db.transactions
      .where('createdAt')
      .above(startOfMonth)
      .and(tx => tx.status !== 'reversed')
      .toArray();
    
    const monthRevenue = monthTxs
      .filter((tx) => tx.type === 'sale' || tx.type === 'service')
      .reduce((acc, tx) => acc + tx.amount, 0);
    const monthExpenses = monthTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);
    const monthLedger = await db.ledger_entries
      .where('createdAt')
      .above(startOfMonth)
      .and((entry) => entry.accountName === 'COGS')
      .toArray();
    const monthCOGS = monthLedger.reduce((acc, entry) => acc + (entry.debit - entry.credit), 0);
    const monthlyProfit = monthRevenue - monthCOGS - monthExpenses;

    return { totalBalance, rangeProfit, monthlyProfit };
  }, [selectedRange, customDate]);

  return (
    <div className="space-y-2">
      <HeroBalanceCard
        balance={stats?.totalBalance || 0}
        todayProfit={stats?.rangeProfit || 0}
        netProfit={stats?.monthlyProfit || 0}
        monthlyGoal={0}
        selectedRange={selectedRange}
        onOpenDatePicker={() => setIsDatePickerOpen(true)}
        customDate={customDate}
      />

      <QuickActions onAction={(label) => {
        if (label === 'Sale') setIsSaleSheetOpen(true);
        if (label === 'Expense') setIsExpenseSheetOpen(true);
      }} />

      <section className="px-4 mb-8 space-y-2.5">
        {reportsSnapshot && <MetricGrid snapshot={reportsSnapshot} />}
        <div className="grid grid-cols-2 gap-2.5">
          <CompactMetricCard
            label={selectedRange === 'today' ? 'Daily Profit' : 'Profit'}
            value={stats?.rangeProfit || 0}
            icon={TrendingUp}
            tone={(stats?.rangeProfit || 0) >= 0 ? 'emerald' : 'red'}
          />
        </div>
      </section>

      <section className="px-4 mt-8 pb-10">
        <div className="flex items-center justify-between px-2 mb-4">
          <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
          <Touchable className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            See All <ArrowRight size={14} />
          </Touchable>
        </div>

        <div className="space-y-2.5">
          {transactions?.map((item) => (
            <TransactionRow
              key={item.localId}
              transaction={item}
              onPress={() => setSelectedTransaction(item)}
            />
          ))}
          {(!transactions || transactions.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm font-bold uppercase tracking-widest">No Recent Activity</p>
            </div>
          )}
        </div>
      </section>

      <RecordSaleSheet
        isOpen={isSaleSheetOpen}
        onClose={() => setIsSaleSheetOpen(false)}
      />

      <RecordExpenseSheet
        isOpen={isExpenseSheetOpen}
        onClose={() => setIsExpenseSheetOpen(false)}
      />

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

      <DateRangePickerSheet
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedRange={selectedRange}
        onSelectRange={setSelectedRange}
        customDate={customDate}
        onSelectCustomDate={setCustomDate}
      />
    </div>
  );
}
