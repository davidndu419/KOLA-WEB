'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Receipt, FileText, Printer } from 'lucide-react';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { TransactionList } from '@/components/sales/transaction-list';
import { HeroSummaryCard } from '@/components/dashboard/hero-summary-card';
import { Touchable } from '@/components/touchable';
import { exportService } from '@/services/exportService';
import { reportsService } from '@/services/reportsService';
import { useAuthStore } from '@/stores/authStore';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { TransactionSearchBar } from '@/components/transactions/transaction-search-bar';

export default function ReportTransactionsPage() {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('last30days');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const businessId = useAuthStore((state) => state.activeBusinessId);
  const business = useAuthStore((state) => state.business);

  const reportsData = useStableLiveQuery(
    () => businessId ? reportsService.getSnapshot(selectedRange, customDate, customEndDate) : undefined,
    [businessId, selectedRange, customDate, customEndDate]
  );

  const showToast = (message: string) => {
    window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message } }));
  };

  const handlePrint = () => {
    if (!reportsData) return;

    try {
      exportService.printTransactionHistory(reportsData, {
        businessId,
        businessName: business?.name || business?.business_name || 'Kola Business',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to print transaction history.';
      showToast(message);
    }
  };

  return (
    <div className="px-6 space-y-4">
      <header className="py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/reports" className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
               History & Export
            </p>
          </div>
        </div>
      </header>

      {reportsData ? (
        <HeroSummaryCard
          title="Transaction Summary"
          subtitle={reportsData.range.label}
          mainValue={reportsData.summary.totalRevenue}
          icon={Receipt}
          variant="emerald"
          watermarkIcon={FileText}
          rangeLabel={reportsData.range.label}
          onOpenDatePicker={() => setIsDatePickerOpen(true)}
          secondaryAction={{
            icon: Printer,
            onPress: handlePrint,
            label: 'Export'
          }}
          stats={[
            { label: 'Total Records', value: reportsData.transactions.length },
            { label: 'Net Profit', value: reportsData.summary.netProfit },
            { label: 'Start Date', value: reportsData.range.startDate.toLocaleDateString() },
            { label: 'End Date', value: reportsData.range.endDate.toLocaleDateString() }
          ]}
        />
      ) : (
        <div className="h-40 rounded-[32px] bg-secondary animate-pulse" />
      )}

      <TransactionSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search transactions, items, categories..."
      />

      {!reportsData ? (
        <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading transactions...</div>
      ) : (
        <TransactionList 
          startDate={reportsData.range.startDate} 
          endDate={reportsData.range.endDate} 
          searchQuery={debouncedSearchQuery}
        />
      )}

      <DateRangePickerSheet
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedRange={selectedRange}
        onSelectRange={setSelectedRange}
        customDate={customDate}
        customEndDate={customEndDate}
        onSelectCustomDate={setCustomDate}
        onSelectCustomEndDate={setCustomEndDate}
      />
    </div>
  );
}
