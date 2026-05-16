'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ServiceHeroCard } from '@/components/service/service-hero-card';
import { RecordServiceSheet } from '@/components/service/record-service-sheet';
import { TransactionList } from '@/components/sales/transaction-list';
import { Touchable } from '@/components/touchable';
import { db } from '@/db/dexie';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { resolveReportDateRange } from '@/services/reportSelectors';
import { CreditButton } from '@/components/credit/credit-button';
import { useAuthStore } from '@/stores/authStore';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';

export default function ServicePage() {
  const router = useRouter();
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const businessId = useAuthStore((state) => state.activeBusinessId);
  
  const stats = useStableLiveQuery(async () => {
    if (!businessId) return undefined;

    const { startDate, endDate } = resolveReportDateRange(selectedRange, customDate);
    
    const transactions = await db.transactions
      .where('created_at')
      .between(startDate, endDate)
      .filter(tx => tx.business_id === businessId && tx.type === 'service' && !tx.deleted_at)
      .toArray();
      
    const totalServiceRevenue = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    const serviceCount = transactions.length;
    
    return { totalServiceRevenue, serviceCount, startDate, endDate };
  }, [businessId, selectedRange, customDate]);

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

      {stats ? (
        <ServiceHeroCard
          totalServiceRevenue={stats.totalServiceRevenue}
          serviceCount={stats.serviceCount}
          selectedRange={selectedRange}
          onOpenDatePicker={() => setIsDatePickerOpen(true)}
          customDate={customDate}
        />
      ) : (
        <div className="h-40 rounded-[32px] bg-secondary animate-pulse" />
      )}

      <div className="flex items-center justify-between px-2 mb-4">
        <h3 className="text-lg font-bold tracking-tight">
          {selectedRange === 'today' ? 'Today\'s Services' : 
           selectedRange === 'custom' ? `Services (${customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : 'Service History'}
        </h3>
      </div>

      {stats ? (
        <TransactionList
          startDate={stats.startDate}
          endDate={stats.endDate}
          type="service"
        />
      ) : (
        <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading services...</div>
      )}

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
