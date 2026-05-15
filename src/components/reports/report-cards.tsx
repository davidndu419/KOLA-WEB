'use client';

import { ReactNode, useMemo, useRef, useState, memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  Package,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { Touchable } from '@/components/touchable';
import { cn } from '@/lib/utils';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { TransactionRow } from '@/components/transactions/transaction-row';
import { ReportsSnapshot, TransactionHistoryItem } from '@/services/reportsService';
import type { Transaction } from '@/db/schema';

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function money(value: number) {
  return currency.format(value || 0).replace('NGN', 'NGN ');
}

function compact(value: number) {
  return new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

export function ReportsHeroCard({
  selectedRange,
  onOpenDatePicker,
  customDate,
  customEndDate,
  totalRevenue,
  totalProfit,
  growthRate,
  rangeLabel,
  isTrendExpanded,
  onToggleTrend,
}: {
  selectedRange: DateRange;
  onOpenDatePicker: () => void;
  customDate?: Date;
  customEndDate?: Date;
  totalRevenue: number;
  totalProfit: number;
  growthRate: number;
  rangeLabel?: string;
  isTrendExpanded?: boolean;
  onToggleTrend?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const fallbackLabels: Record<DateRange, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    lastWeek: 'Last Week',
    last7days: 'Last 7 Days',
    last30days: 'Last 30 Days',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    thisYear: 'This Year',
    allTime: 'All Time',
    custom:
      customDate && customEndDate && customDate.toDateString() !== customEndDate.toDateString()
        ? `${customDate.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} - ${customEndDate.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`
        : customDate?.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) || 'Custom',
  };

  const profitIsPositive = totalProfit >= 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 28 }}
      className="relative p-6 rounded-[32px] bg-indigo-950 text-white shadow-2xl overflow-hidden mb-6"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-28 h-28 bg-blue-400/10 rounded-full -ml-12 -mb-12" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">Business Analytics</p>
            <h2 className="text-2xl font-bold tracking-tight">Growth Report</h2>
          </div>
          <Touchable
            onPress={onOpenDatePicker}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-2xl border border-white/20"
          >
            <Calendar size={14} className="text-indigo-200" />
            <div className="text-left">
              <p className="text-[8px] font-black uppercase tracking-tighter text-indigo-200 leading-none">Period</p>
              <p className="text-[10px] font-bold text-white leading-none mt-1">{rangeLabel || fallbackLabels[selectedRange]}</p>
            </div>
          </Touchable>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Revenue</p>
            <motion.p
              key={totalRevenue}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : undefined}
              className="text-xl font-bold italic"
            >
              {money(totalRevenue)}
            </motion.p>
          </div>
          <div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Net Profit</p>
            <motion.p
              key={totalProfit}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : undefined}
              className={cn('text-xl font-bold', profitIsPositive ? 'text-emerald-300' : 'text-red-300')}
            >
              {money(totalProfit)}
            </motion.p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/70">
            {growthRate >= 0 ? <TrendingUp size={14} className="text-emerald-300" /> : <TrendingDown size={14} className="text-red-300" />}
            {growthRate === 0 ? 'No movement yet' : `${Math.abs(growthRate)}% ${growthRate > 0 ? 'above' : 'below'} previous period`}
          </div>
          {onToggleTrend && (
            <Touchable
              onPress={onToggleTrend}
              className="px-3 py-2 rounded-2xl bg-white/10 border border-white/15 flex items-center gap-2 text-[10px] font-black text-emerald-200"
            >
              View trend
              <motion.span
                animate={{ rotate: isTrendExpanded ? 180 : 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }}
              >
                <ChevronDown size={14} />
              </motion.span>
            </Touchable>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const MetricGrid = memo(({ snapshot }: { snapshot: ReportsSnapshot }) => {
  const metrics = [
    { label: 'Sales', value: snapshot.summary.totalSales, icon: ShoppingBag, tone: 'emerald' },
    { label: 'Services', value: snapshot.summary.totalServiceIncome, icon: Zap, tone: 'indigo' },
    { label: 'Expenses', value: snapshot.summary.totalExpenses, icon: Receipt, tone: 'red' },
    { label: 'Receivables', value: snapshot.summary.totalReceivables, icon: CreditCard, tone: 'amber' },
    { label: 'Inventory', value: snapshot.summary.inventoryValue, icon: Package, tone: 'blue' },
    { label: 'Daily Profit', value: snapshot.summary.netProfit, icon: TrendingUp, tone: 'emerald' },
  ];

  return (
    <section className="grid grid-cols-2 gap-2.5">
      {metrics.map((metric) => {
        return (
          <CompactMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            tone={metric.tone as MetricTone}
          />
        );
      })}
    </section>
  );
});

type MetricTone = 'emerald' | 'indigo' | 'red' | 'amber' | 'blue' | 'slate';

export const CompactMetricCard = memo(({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: MetricTone;
}) => {
  return (
    <div className="bg-card border border-border/60 shadow-md shadow-black/5 p-3 rounded-[24px] min-h-[92px]">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={cn(
            'w-8 h-8 rounded-2xl flex items-center justify-center',
            tone === 'emerald' && 'bg-emerald-500/10 text-emerald-600',
            tone === 'indigo' && 'bg-indigo-500/10 text-indigo-600',
            tone === 'red' && 'bg-red-500/10 text-red-600',
            tone === 'amber' && 'bg-amber-500/10 text-amber-600',
            tone === 'blue' && 'bg-blue-500/10 text-blue-600',
            tone === 'slate' && 'bg-slate-500/10 text-slate-600'
          )}
        >
          <Icon size={15} />
        </div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">{label}</p>
      </div>
      <p className="text-base font-black tabular-nums truncate">{money(value)}</p>
    </div>
  );
});

export function SmartInsightsPanel({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-card border border-border/60 shadow-lg shadow-black/5 rounded-[28px] overflow-hidden">
      <Touchable onPress={() => setIsOpen((value) => !value)} className="w-full p-5 flex items-center justify-between text-left">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Smart Insights</p>
          <h3 className="text-lg font-bold">{count} business signals</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
          className="w-10 h-10 rounded-2xl bg-secondary text-primary flex items-center justify-center"
        >
          <ChevronDown size={18} />
        </motion.div>
      </Touchable>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="insights"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 grid gap-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function InsightCard({
  title,
  value,
  insight,
  color = 'emerald',
  icon: Icon = Sparkles,
}: {
  title: string;
  value: string;
  insight: string;
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'indigo';
  icon?: typeof Sparkles;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600',
    amber: 'bg-amber-500/10 text-amber-600',
    red: 'bg-red-500/10 text-red-600',
    indigo: 'bg-indigo-500/10 text-indigo-600',
  };

  return (
    <div className="bg-secondary/50 p-4 rounded-[24px] flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', colors[color])}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        <p className="text-lg font-bold truncate">{value}</p>
        <p className="text-[10px] font-medium text-muted-foreground/70 leading-tight">{insight}</p>
      </div>
    </div>
  );
}

export function ProfitLossCard({ snapshot }: { snapshot: ReportsSnapshot }) {
  const rows = [
    ['Revenue', snapshot.profitLoss.totalRevenue],
    ['Cost of goods', -snapshot.profitLoss.costOfGoodsSold],
    ['Gross profit', snapshot.profitLoss.grossProfit],
    ['Operating expenses', -snapshot.profitLoss.operatingExpenses],
    ['Net profit', snapshot.profitLoss.netProfit],
  ];

  return (
    <section className="bg-card border border-border/60 shadow-lg shadow-black/5 p-5 rounded-[28px] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Profit & Loss</p>
          <h3 className="text-lg font-bold">Margin {snapshot.profitLoss.profit_margin}%</h3>
        </div>
        <div
          className={cn(
            'px-2 py-1 rounded-full text-xs font-bold',
            snapshot.profitLoss.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
          )}
        >
          {snapshot.profitLoss.netProfit >= 0 ? 'Healthy' : 'Watch costs'}
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="font-bold text-muted-foreground">{label}</span>
            <span className={cn('font-bold tabular-nums', Number(value) < 0 ? 'text-red-500' : 'text-foreground')}>{money(Number(value))}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BreakdownCard({ snapshot }: { snapshot: ReportsSnapshot }) {
  const segments = snapshot.paymentBreakdown.segments;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <section className="bg-card border border-border/60 shadow-lg shadow-black/5 p-5 rounded-[28px] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Mix</p>
          <h3 className="text-lg font-bold">{money(total)}</h3>
        </div>
        <Banknote size={20} className="text-primary" />
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 rounded-full bg-secondary overflow-hidden">
          <div className="absolute inset-3 rounded-full bg-card z-10" />
          {segments.length === 0 ? (
            <div className="absolute inset-0 bg-muted" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(#10b981 0 ${segments[0]?.percentage || 0}%, #3b82f6 ${segments[0]?.percentage || 0}% ${
                  (segments[0]?.percentage || 0) + (segments[1]?.percentage || 0)
                }%, #f59e0b ${(segments[0]?.percentage || 0) + (segments[1]?.percentage || 0)}% 100%)`,
              }}
            />
          )}
        </div>
        <div className="flex-1 space-y-2">
          {(['cash', 'transfer', 'credit'] as const).map((key) => {
            const value = snapshot.paymentBreakdown[key];
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            const color = key === 'cash' ? 'bg-emerald-500' : key === 'transfer' ? 'bg-blue-500' : 'bg-amber-500';
            return <LegendRow key={key} label={key} value={`${percentage}% | ${money(value)}`} colorClass={color} />;
          })}
        </div>
      </div>
    </section>
  );
}

function LegendRow({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-2 font-bold capitalize">
        <span className={cn('w-2.5 h-2.5 rounded-full', colorClass)} />
        {label}
      </span>
      <span className="text-muted-foreground font-bold tabular-nums">{value}</span>
    </div>
  );
}

export function OperationalReports({ snapshot }: { snapshot: ReportsSnapshot }) {
  const cards = [
    {
      key: 'inventory',
      label: 'Inventory',
      title: `${snapshot.inventory.lowStockProducts.length} low stock`,
      icon: Package,
      iconClass: 'text-blue-600',
      stats: [
        ['Value', money(snapshot.inventory.inventoryValue)],
        ['Potential', money(snapshot.inventory.estimatedProfitPotential)],
        ['Age', `${snapshot.inventory.averageStockAgeDays}d`],
      ],
    },
    {
      key: 'cash',
      label: 'Cash Flow',
      title: money(snapshot.cashFlow.netCashFlow),
      icon: Wallet,
      iconClass: 'text-emerald-600',
      stats: [
        ['Inflow', money(snapshot.cashFlow.cashInflow)],
        ['Outflow', money(snapshot.cashFlow.cashOutflow)],
        ['Credit', money(snapshot.cashFlow.creditImpact)],
      ],
    },
    {
      key: 'receivables',
      label: 'Receivables',
      title: money(snapshot.receivables.totalOutstanding),
      icon: CreditCard,
      iconClass: 'text-amber-600',
      stats: [
        ['Overdue', money(snapshot.receivables.overdueAmount)],
        ['Paid', `${snapshot.receivables.paymentCompletionRate}%`],
        ['Customers', String(snapshot.receivables.customerBalances.length)],
      ],
    },
  ];

  return (
    <section className="-mx-6 overflow-x-auto scrollbar-none px-6" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-3 pr-6" style={{ willChange: 'transform' }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="snap-start min-w-[285px] bg-card border border-border/60 shadow-lg shadow-black/5 p-5 rounded-[28px] space-y-4"
              style={{ scrollSnapAlign: 'start', willChange: 'transform' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                  <h3 className={cn('text-lg font-bold', card.key === 'cash' && snapshot.cashFlow.netCashFlow >= 0 && 'text-emerald-600', card.key === 'cash' && snapshot.cashFlow.netCashFlow < 0 && 'text-red-600')}>
                    {card.title}
                  </h3>
                </div>
                <Icon size={20} className={card.iconClass} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {card.stats.map(([label, value]) => (
                  <MiniStat key={label} label={label} value={value} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/70 rounded-2xl p-3 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">{label}</p>
      <p className="text-xs font-bold tabular-nums truncate">{value}</p>
    </div>
  );
}

export function RankedListCard({
  title,
  items,
  emptyText,
  valueLabel = 'revenue',
}: {
  title: string;
  items: { id: string; name: string; quantity: number; revenue: number; profit: number }[];
  emptyText: string;
  valueLabel?: 'revenue' | 'profit';
}) {
  return (
    <section className="glass-card p-5 rounded-[28px] space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground font-medium">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-xs font-black">{index + 1}</div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{item.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{item.quantity} activity</p>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums">{money(valueLabel === 'profit' ? item.profit : item.revenue)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TransactionHistoryEngine({ transactions }: { transactions: TransactionHistoryItem[] }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'sale' | 'service' | 'expense'>('all');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((item) => {
      if (type !== 'all' && item.transaction.type !== type) return false;
      if (!needle) return true;
      return [item.transaction.local_id, item.title, item.subtitle, item.transaction.note, ...item.items.map((entry) => entry.name)]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [query, transactions, type]);

  // TanStack Virtual intentionally exposes imperative helpers for mobile-scale lists.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 66,
    overscan: 6,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transaction History</p>
          <h3 className="text-lg font-bold">{filtered.length} records</h3>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reports, customers, items..."
          className="w-full bg-secondary rounded-2xl p-4 pl-11 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {(['all', 'sale', 'service', 'expense'] as const).map((item) => (
          <Touchable
            key={item}
            onPress={() => setType(item)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide border whitespace-nowrap',
              type === item ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-transparent'
            )}
          >
            {item}
          </Touchable>
        ))}
      </div>

      <div ref={parentRef} className="h-[420px] overflow-y-auto scrollbar-none">
        {filtered.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center text-muted-foreground font-bold">No matching transactions</div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = filtered[virtualRow.index];
              return (
                <div
                  key={item.transaction.local_id}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="pb-2">
                    <TransactionRow
                      transaction={item.transaction}
                      onPress={() => setSelected(item.transaction)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TransactionDetailSheet transaction={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

export function ExportActions({
  onPdf,
  onCsv,
  onPrint,
}: {
  onPdf: () => void;
  onCsv: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Touchable onPress={onPdf} className="bg-secondary text-primary font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-xs">
        <Download size={16} /> PDF
      </Touchable>
      <Touchable onPress={onCsv} className="bg-secondary text-primary font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-xs">
        <FileText size={16} /> CSV
      </Touchable>
      <Touchable onPress={onPrint} className="bg-secondary text-primary font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-xs">
        <Printer size={16} /> Print
      </Touchable>
    </div>
  );
}

export function ReportEmptyState() {
  return (
    <div className="glass-card rounded-[32px] p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <AlertTriangle size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold">No report data yet</h3>
        <p className="text-sm text-muted-foreground font-medium">Record a sale, service, expense, or stock movement to start building your business report.</p>
      </div>
    </div>
  );
}

export { money, compact };
