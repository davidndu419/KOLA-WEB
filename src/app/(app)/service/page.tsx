'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ServiceHeroCard } from '@/components/service/service-hero-card';
import { RecordServiceSheet } from '@/components/service/record-service-sheet';
import { TransactionList } from '@/components/sales/transaction-list';
import { Touchable } from '@/components/touchable';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { resolveReportDateRange } from '@/services/reportSelectors';
import { CreditButton } from '@/components/credit/credit-button';

export default function ServicePage() {
  const router = useRouter();
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  
  const stats = useLiveQuery(async () => {
    const { startDate, endDate } = resolveReportDateRange(selectedRange, customDate);
    
    const transactions = await db.transactions
      .where('created_at')
      .between(startDate, endDate)
      .filter(tx => tx.type === 'service')
      .toArray();
      
    const totalServiceRevenue = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    const serviceCount = transactions.length;
    
    return { totalServiceRevenue, serviceCount, startDate, endDate };
  }, [selectedRange, customDate]);

  return (
    <div className="px-6 space-y-2">
      <header className="py-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground font-medium">Manage your craft</p>
        </div>
        <div className="flex gap-2">
          <CreditButton sourceType="service" onPress={() => router.push('/service/credit')} />
        </div>
      </header>

      <ServiceHeroCard 
        totalServiceRevenue={stats?.totalServiceRevenue || 0}
        serviceCount={stats?.serviceCount || 0}
        selectedRange={selectedRange}
        onOpenDatePicker={() => setIsDatePickerOpen(true)}
        customDate={customDate}
      />

      <div className="flex items-center justify-between px-2 mb-4">
        <h3 className="text-lg font-bold tracking-tight">
          {selectedRange === 'today' ? 'Today\'s Services' : 
           selectedRange === 'custom' ? `Services (${customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : 'Service History'}
        </h3>
      </div>

      <TransactionList 
        startDate={stats?.startDate} 
        endDate={stats?.endDate} 
        type="service"
      />

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-30">
        <Touchable 
          onPress={() => setIsRecordSheetOpen(true)}
          className="w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-500/40 flex items-center justify-center"
        >
          <Plus size={32} strokeWidth={2.5} />
        </Touchable>
      </div>

      <RecordServiceSheet 
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
