'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SalesHeroCard } from '@/components/sales/sales-hero-card';
import { TransactionList } from '@/components/sales/transaction-list';
import { Touchable } from '@/components/touchable';
import { db } from '@/db/dexie';
import { RecordSaleSheet } from '@/components/sales/record-sale-sheet';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { resolveReportDateRange } from '@/services/reportSelectors';
import { CreditButton } from '@/components/credit/credit-button';
import { useAuthStore } from '@/stores/authStore';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { TransactionSearchBar } from '@/components/transactions/transaction-search-bar';

export default function SalesPage() {
  const router = useRouter();
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const businessId = useAuthStore((state) => state.activeBusinessId);
  
  const stats = useStableLiveQuery(async () => {
    if (!businessId) return undefined;

    const { startDate, endDate } = resolveReportDateRange(selectedRange, customDate);
    
    const transactions = await db.transactions
      .where('created_at')
      .between(startDate, endDate)
      .toArray();

    const businessTransactions = transactions.filter((tx) => tx.business_id === businessId && !tx.deleted_at);
      
    const totalSales = businessTransactions
      .filter(tx => tx.type === 'sale')
      .reduce((acc, tx) => acc + tx.amount, 0);
      
    const transactionCount = businessTransactions.filter(tx => tx.type === 'sale').length;

    // Receivables usually remain lifetime unless filtered
    const allLedger = await db.ledger_entries.where('business_id').equals(businessId).toArray();
    const receivables = allLedger
     .reduce((acc, entry: any) => {
  let balance = 0;
  
  if (entry.debit_account === 'Receivables') balance += entry.amount;
  if (entry.credit_account === 'Receivables') balance -= entry.amount;
  
  return acc + balance;
}, 0);


    const cashSales = businessTransactions
      .filter(tx => tx.type === 'sale' && tx.payment_method === 'cash')
      .reduce((acc, tx) => acc + tx.amount, 0);
      
    const cashPercentage = totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 100;
    
    return { totalSales, transactionCount, receivables, cashPercentage, startDate, endDate };
  }, [businessId, selectedRange, customDate]);

  return (
    <div className="px-6 space-y-2">
      <header className="py-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground font-medium">Business history & trends</p>
        </div>
        <div className="flex gap-2">
          <CreditButton sourceType="sale" onPress={() => router.push('/sales/credit')} />
        </div>
      </header>

      {stats ? (
        <SalesHeroCard
          totalSales={stats.totalSales}
          transactionCount={stats.transactionCount}
          receivables={stats.receivables}
          cashPercentage={stats.cashPercentage}
          selectedRange={selectedRange}
          onOpenDatePicker={() => setIsDatePickerOpen(true)}
          customDate={customDate}
        />
      ) : (
        <div className="h-40 rounded-[32px] bg-secondary animate-pulse" />
      )}

      <TransactionSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search sales, products, amounts..."
      />

      <div className="flex items-center justify-between px-2 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">History</h3>
        <span className="text-[10px] font-black text-muted-foreground/50 bg-secondary px-2 py-1 rounded-md">
          {historyCount ?? stats?.transactionCount ?? 0} TOTAL
        </span>
      </div>

      {stats ? (
        <TransactionList
          startDate={stats.startDate}
          endDate={stats.endDate}
          type="sale"
          searchQuery={debouncedSearchQuery}
          onCountChange={setHistoryCount}
        />
      ) : (
        <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading sales...</div>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-30">
        <Touchable 
          onPress={() => setIsRecordSheetOpen(true)}
          className="w-16 h-16 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center"
        >
          <Plus size={32} strokeWidth={2.5} />
        </Touchable>
      </div>

      <RecordSaleSheet 
        isOpen={isRecordSheetOpen} 
        onClose={() => setIsRecordSheetOpen(false)} 
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
