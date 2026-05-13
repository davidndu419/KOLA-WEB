'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Download } from 'lucide-react';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { ExportActions, TransactionHistoryEngine } from '@/components/reports/report-cards';
import { Touchable } from '@/components/touchable';
import { exportService } from '@/services/exportService';
import { reportsService } from '@/services/reportsService';

export default function ReportTransactionsPage() {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('last30days');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());

  const reportsData = useLiveQuery(
    () => reportsService.getSnapshot(selectedRange, customDate, customEndDate),
    [selectedRange, customDate, customEndDate]
  );

  return (
    <div className="px-6 space-y-4 pb-24">
      <header className="py-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/reports" className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground font-medium truncate">
              {reportsData?.range.label || 'Live transaction history'}
            </p>
          </div>
        </div>

        <Touchable
          onPress={() => setIsDatePickerOpen(true)}
          className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0"
        >
          <Calendar size={19} />
        </Touchable>
      </header>

      <div className="glass-card p-5 rounded-[28px] flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Records</p>
          <p className="text-2xl font-bold">{reportsData?.transactions.length || 0}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Download size={20} />
        </div>
      </div>

      {!reportsData ? (
        <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading transactions...</div>
      ) : (
        <>
          <TransactionHistoryEngine transactions={reportsData.transactions} />
          <ExportActions
            onPdf={() => exportService.toPdf(reportsData)}
            onCsv={() => exportService.toCsv(reportsData)}
            onPrint={() => exportService.print(reportsData)}
          />
        </>
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
