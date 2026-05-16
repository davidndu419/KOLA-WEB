'use client';

import { useState } from 'react';
import { Plus, Search, Receipt, TrendingDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { TransactionList } from '@/components/sales/transaction-list';
import { RecordExpenseSheet } from '@/components/finance/record-expense-sheet';
import { Touchable } from '@/components/touchable';
import { CompactMetricCard } from '@/components/reports/report-cards';
import { Transaction } from '@/db/schema';
import { reportService } from '@/services/reportService';
import { reportsService } from '@/services/reportsService';
import { motion } from 'framer-motion';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { HeroSummaryCard } from '@/components/dashboard/hero-summary-card';
import { Calendar } from 'lucide-react';

export default function ExpensesPage() {
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('thisMonth');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const reportsData = useLiveQuery(
    () => reportsService.getSnapshot(selectedRange, customDate),
    [selectedRange, customDate]
  );

  const expenses = useLiveQuery(async () => {
    let collection = db.transactions
      .where('type')
      .equals('expense')
      .reverse();
    
    let results = await collection.toArray();
    
    // Filter out restocks from operating expenses list
    results = results.filter(tx => tx.source_type !== 'restock');

    // Filter by date range if not allTime
    if (reportsData?.range) {
        results = results.filter(tx => 
            tx.created_at >= reportsData.range.startDate && 
            tx.created_at <= reportsData.range.endDate
        );
    }

    if (searchQuery) {
      return results.filter(tx => 
        tx.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.amount.toString().includes(searchQuery)
      );
    }
    
    return results;
  }, [searchQuery, reportsData]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Stats */}
      <section className="px-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Expenses</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Manage your spending</p>
          </div>
        </div>

        <HeroSummaryCard
          title="Total Expenses"
          subtitle={reportsData?.range.label || 'Loading...'}
          mainValue={reportsData?.summary.totalExpenses || 0}
          icon={Receipt}
          variant="red"
          watermarkIcon={TrendingDown}
          rangeLabel={reportsData?.range.label}
          onOpenDatePicker={() => setIsDatePickerOpen(true)}
          stats={[
            { label: 'Total Records', value: expenses?.length || 0 },
            { label: 'Selected Period', value: reportsData?.range.label || 'Selected' }
          ]}
        />
      </section>

      {/* Search */}
      <section className="px-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search expenses, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 rounded-[22px] p-4 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20 transition-all border border-transparent focus:border-red-500/30"
          />
        </div>
      </section>

      {/* List */}
      <section className="px-4">
        <div className="flex items-center justify-between px-2 mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">History</h3>
          <span className="text-[10px] font-black text-muted-foreground/50 bg-secondary px-2 py-1 rounded-md">
            {expenses?.length || 0} TOTAL
          </span>
        </div>

        <TransactionList 
          transactions={expenses} 
          type="expense"
        />
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-4 z-40">
        <Touchable 
          onPress={() => setIsExpenseSheetOpen(true)}
          className="h-14 px-6 bg-red-500 text-white rounded-[24px] flex items-center gap-3 shadow-2xl shadow-red-500/40 active:scale-95 transition-transform"
        >
          <Plus size={24} strokeWidth={3} />
          <span className="text-xs font-black uppercase tracking-widest">Record</span>
        </Touchable>
      </div>

      <RecordExpenseSheet 
        isOpen={isExpenseSheetOpen} 
        onClose={() => setIsExpenseSheetOpen(false)} 
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
