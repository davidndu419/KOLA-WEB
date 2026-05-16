'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BreakdownCard,
  InsightCard,
  OperationalReports,
  ProfitLossCard,
  RankedListCard,
  ReportEmptyState,
  ReportsHeroCard,
  SmartInsightsPanel,
  compact,
  money,
} from '@/components/reports/report-cards';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { reportsService } from '@/services/reportsService';
import { AlertTriangle, Package, Receipt, Sparkles, TrendingUp, Zap } from 'lucide-react';

import { RevenueChartCard } from '@/components/reports/revenue-chart-card';


export default function ReportsPage() {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isRevenueExpanded, setIsRevenueExpanded] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('last7days');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());

  const reportsData = useLiveQuery(
    () => reportsService.getSnapshot(selectedRange, customDate, customEndDate),
    [selectedRange, customDate, customEndDate]
  );

  const bestProduct = reportsData?.topSellingProducts[0];
  const bestService = reportsData?.bestPerformingServices[0];
  const strongestProfit = reportsData?.mostProfitableItems[0];

  const hasActivity = useMemo(() => {
    if (!reportsData) return false;
    return reportsData.summary.totalTransactions > 0 || reportsData.inventory.inventoryValue > 0 || reportsData.receivables.totalOutstanding > 0;
  }, [reportsData]);

  return (
    <div className="px-6 space-y-4">
      <header className="py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground font-medium">Business insights & growth</p>
        </div>
        <Link
          href="/reports/transactions"
          aria-label="Open transaction history"
          className="h-11 px-3 rounded-2xl bg-secondary text-primary flex items-center justify-center gap-2 flex-shrink-0 active:scale-95 transition-transform"
        >
          <Receipt size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wide leading-none text-left">
            Transaction<br />History
          </span>
        </Link>
      </header>

      <ReportsHeroCard
        selectedRange={selectedRange}
        onOpenDatePicker={() => setIsDatePickerOpen(true)}
        customDate={customDate}
        customEndDate={customEndDate}
        totalRevenue={reportsData?.summary.totalRevenue || 0}
        totalProfit={reportsData?.summary.netProfit || 0}
        growthRate={reportsData?.revenue.growthRate || 0}
        rangeLabel={reportsData?.range.label}
        isTrendExpanded={isRevenueExpanded}
        onToggleTrend={() => setIsRevenueExpanded((value) => !value)}
      />

      {!reportsData ? (
        <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Preparing live reports...</div>
      ) : (
        <>
          {!hasActivity && <ReportEmptyState />}

          {isRevenueExpanded && <RevenueChartCard data={reportsData.revenue.series} growthRate={reportsData.revenue.growthRate} />}

          <SmartInsightsPanel count={5}>
            <InsightCard
              title="Best Seller"
              value={bestProduct?.name || 'No product leader yet'}
              insight={bestProduct ? `${compact(bestProduct.quantity)} sold with ${money(bestProduct.revenue)} revenue.` : 'Product trends will appear after sales.'}
              color="blue"
              icon={TrendingUp}
            />
            <InsightCard
              title="Profit Margin"
              value={`${reportsData.profitLoss.profit_margin}%`}
              insight="Net profit margin across all operations in this range."
              color={reportsData.profitLoss.profit_margin >= 0 ? 'emerald' : 'red'}
              icon={Sparkles}
            />
            <InsightCard
              title="Low Stock Risk"
              value={`${reportsData.inventory.lowStockProducts.length} Items`}
              insight="Items currently below their reorder comfort line."
              color="amber"
              icon={AlertTriangle}
            />
            <InsightCard
              title="Best Service"
              value={bestService?.name || 'No service leader yet'}
              insight={bestService ? `${bestService.quantity} completed with ${money(bestService.revenue)} income.` : 'Service trends will appear as work is recorded.'}
              color="indigo"
              icon={Zap}
            />
            <InsightCard
              title="Profit Power"
              value={strongestProfit?.name || 'No product profit yet'}
              insight={strongestProfit ? `${money(strongestProfit.profit)} gross profit from this item.` : 'Profitability ranks after product sales.'}
              color="emerald"
              icon={Package}
            />
          </SmartInsightsPanel>

          <ProfitLossCard snapshot={reportsData} />
          <BreakdownCard snapshot={reportsData} />
          <OperationalReports snapshot={reportsData} />

          {reportsData.topSellingProducts.length > 0 && (
            <RankedListCard title="Top-Selling Products" items={reportsData.topSellingProducts} emptyText="No product sales in this period." />
          )}
          {reportsData.mostProfitableItems.length > 0 && (
            <RankedListCard title="Most Profitable Items" items={reportsData.mostProfitableItems} emptyText="Profit leaders will appear after product sales." valueLabel="profit" />
          )}
          {reportsData.bestPerformingServices.length > 0 && (
            <RankedListCard title="Best-Performing Services" items={reportsData.bestPerformingServices} emptyText="No services recorded in this period." />
          )}
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
