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
import { reportService } from '@/services/reportService';
import { reportsService } from '@/services/reportsService';
import { TransactionList } from '@/components/sales/transaction-list';
import { db } from '@/db/dexie';
import Link from 'next/link';

import type { Transaction, LedgerEntry } from '@/db/schema';

export default function DashboardPage() {
  const [isSaleSheetOpen, setIsSaleSheetOpen] = useState(false);
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isServiceSheetOpen, setIsServiceSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
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
    // 1. Total Balance calculation (Net of all Cash/Receivables entries)
    // Optimized: only query relevant accounts
    const accounts = ['Cash', 'Bank', 'Receivables'];
    const relevantEntries = await db.ledger_entries
      .where('debit_account').anyOf(accounts)
      .or('credit_account').anyOf(accounts)
      .toArray();

    let totalBalance = 0;
    for (const entry of relevantEntries) {
      if (entry.deleted_at) continue;
      if (accounts.includes(entry.debit_account)) totalBalance += entry.amount;
      if (accounts.includes(entry.credit_account)) totalBalance -= entry.amount;
    }

    // 2. Range Profit calculation from snapshot
    const rangeProfit = reportsSnapshot?.summary.netProfit || 0;

    // 3. Monthly Profit calculation (Lighter query)
    const monthlyPnL = await reportService.getProfitLoss('thisMonth');

    return { 
      totalBalance, 
      rangeProfit, 
      monthlyProfit: monthlyPnL.netProfit 
    };
  }, [reportsSnapshot, selectedRange, customDate]);


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
        if (label === 'Stock') router.push('/inventory/add');
        if (label === 'Report') router.push('/reports');
      }} />

      <section className="px-4 mb-8 space-y-2.5">
        {reportsSnapshot && <MetricGrid snapshot={reportsSnapshot} />}
      </section>

      <section className="px-4 mt-8 pb-10">
        <div className="flex items-center justify-between px-2 mb-4">
          <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
          <Link href="/reports/transactions" className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            See All <ArrowRight size={14} />
          </Link>
        </div>

        <TransactionList limit={5} />
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
