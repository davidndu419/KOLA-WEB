'use client';

import { useState } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeroBalanceCard } from '@/components/dashboard/hero-balance-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { CompactMetricCard, MetricGrid } from '@/components/reports/report-cards';
import { RecordSaleSheet } from '@/components/sales/record-sale-sheet';
import { RecordExpenseSheet } from '@/components/finance/record-expense-sheet';
import { RecordServiceSheet } from '@/components/service/record-service-sheet';
import { AddProductSheet } from '@/components/inventory/add-product-sheet';
import { useRouter } from 'next/navigation';
import { Touchable } from '@/components/touchable';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { TransactionRow } from '@/components/transactions/transaction-row';
import { db } from '@/db/dexie';
import { resolveReportDateRange } from '@/services/reportSelectors';
import { reportsService } from '@/services/reportsService';
import { reportService } from '@/services/reportService';

import type { Transaction, LedgerEntry } from '@/db/schema';

import { ReversalSheet } from '@/components/transactions/reversal-sheet';
import { CorrectionSheet } from '@/components/transactions/correction-sheet';
import { AuditTrailSheet } from '@/components/transactions/audit-trail-sheet';

export default function DashboardPage() {
  const [isSaleSheetOpen, setIsSaleSheetOpen] = useState(false);
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [isStockSheetOpen, setIsStockSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const router = useRouter();
  const [customDate, setCustomDate] = useState<Date>(new Date());

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('created_at').reverse().limit(5).toArray()
  );

  const reportsSnapshot = useLiveQuery(
    () => reportsService.getSnapshot(selectedRange, customDate),
    [selectedRange, customDate]
  );

  const stats = useLiveQuery(async () => {
    const { startDate, endDate } = resolveReportDateRange(selectedRange, customDate);

    // 1. Total Balance calculation (Net of all Cash/Receivables entries)
    let totalBalance = 0;
    await db.ledger_entries.each((entry: LedgerEntry) => {
      const accounts = ['Cash', 'Bank', 'Receivables'];
      
      if (accounts.includes(entry.debit_account)) {
        totalBalance += entry.amount;
      }
      
      if (accounts.includes(entry.credit_account)) {
        totalBalance -= entry.amount;
      }
    });



    // 2. Range Profit calculation
    const pnL = await reportService.getProfitLoss(selectedRange, customDate);
    
    // 3. Monthly Profit calculation
    const monthlyPnL = await reportService.getProfitLoss('thisMonth');

    return { 
      totalBalance, 
      rangeProfit: pnL.netProfit, 
      monthlyProfit: monthlyPnL.netProfit 
    };
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
        if (label === 'Service') setIsServiceSheetOpen(true);
        if (label === 'Stock') setIsStockSheetOpen(true);
        if (label === 'Report') router.push('/reports');
      }} />

      <section className="px-4 mb-8 space-y-2.5">
        {reportsSnapshot && <MetricGrid snapshot={reportsSnapshot} />}
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
              key={item.local_id}
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

      <RecordServiceSheet
        isOpen={isServiceSheetOpen}
        onClose={() => setIsServiceSheetOpen(false)}
      />

      <AddProductSheet
        isOpen={isStockSheetOpen}
        onClose={() => setIsStockSheetOpen(false)}
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
        transaction_id={selectedTransaction?.local_id || null}
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
