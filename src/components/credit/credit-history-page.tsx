'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileText,
  ReceiptText,
  WalletCards,
  Calendar,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { cn } from '@/lib/utils';
import {
  creditService,
  type CreditFilter,
  type CreditHistoryItem,
  type CreditSourceType,
} from '@/services/credit.service';
import type { Transaction } from '@/db/schema';
import { DateRangePickerSheet, DateRange } from '@/components/dashboard/date-range-picker-sheet';
import { HeroSummaryCard } from '@/components/dashboard/hero-summary-card';

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const filters: { id: CreditFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'partially-paid', label: 'Partial' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
];

function money(value: number) {
  return currency.format(value || 0).replace('NGN', 'NGN ');
}

function shortDate(date: Date) {
  return date.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusLabel(item: CreditHistoryItem) {
  if (item.isOverdue) return 'Overdue';
  if (item.receivable.status === 'partially-paid') return 'Partial';
  return item.receivable.status;
}

function isFilterMatch(item: CreditHistoryItem, filter: CreditFilter) {
  if (filter === 'all') return true;
  if (filter === 'overdue') return item.isOverdue;
  return item.receivable.status === filter;
}

export function CreditHistoryPage({ sourceType }: { sourceType: CreditSourceType }) {
  const router = useRouter();
  const [filter, setFilter] = useState<CreditFilter>('all');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange>('allTime');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<{
    item: CreditHistoryItem;
    mode: 'confirm' | 'partial';
  } | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const data = useLiveQuery(async () => {
    const history = sourceType === 'sale'
      ? await creditService.getSalesCreditHistory()
      : await creditService.getServiceCreditHistory();
    const summary = sourceType === 'sale'
      ? await creditService.getSalesCreditSummary()
      : await creditService.getServiceCreditSummary();

    return { history, summary };
  }, [sourceType]);

  const filteredHistory = useMemo(
    () => (data?.history || []).filter((item) => isFilterMatch(item, filter)),
    [data?.history, filter]
  );

  const title = sourceType === 'sale' ? 'Sales Credit' : 'Service Credit';
  const subtitle = sourceType === 'sale' ? 'Unpaid sales history' : 'Unpaid service history';
  const themeVariant = sourceType === 'sale' ? 'emerald' : 'indigo';
  const themeIcon = sourceType === 'sale' ? ReceiptText : Zap;

  return (
    <div className="px-5 space-y-6">
      <header className="py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Touchable
            onPress={() => router.back()}
            className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground"
            >
            <ArrowLeft size={20} />
            </Touchable>
            <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{subtitle}</p>
            </div>
        </div>
      </header>

      <HeroSummaryCard
        title="Total Credit"
        subtitle={title}
        mainValue={data?.summary.totalPending || 0}
        icon={themeIcon}
        variant={themeVariant}
        watermarkIcon={WalletCards}
        rangeLabel={selectedRange === 'allTime' ? 'All Time' : 'Filtered'}
        onOpenDatePicker={() => setIsDatePickerOpen(true)}
        stats={[
          { label: 'Pending', value: data?.summary.pendingCount || 0 },
          { label: 'Open', value: data?.summary.pendingCount || 0 },
          { label: 'Paid', value: data?.summary.paidCount || 0 },
          { label: 'Overdue', value: data?.summary.overdueCount || 0, color: (data?.summary.overdueCount || 0) > 0 ? 'text-red-300' : 'text-white' }
        ]}
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {filters.map((item) => (
          <Touchable
            key={item.id}
            onPress={() => setFilter(item.id)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide border whitespace-nowrap',
              filter === item.id
                ? 'bg-primary text-white border-primary'
                : 'bg-secondary text-muted-foreground border-transparent'
            )}
          >
            {item.label}
          </Touchable>
        ))}
      </div>

      <section className="space-y-3">
        {!data ? (
          <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">
            Loading credits...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
             <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                <WalletCards size={32} />
             </div>
             <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No credits found</p>
             <p className="text-[10px] font-bold text-muted-foreground/60 mt-1 uppercase tracking-tighter">Your debt records will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredHistory.map((item) => (
              <CreditCompactRow
                key={item.receivable.local_id}
                item={item}
                isExpanded={expandedId === item.receivable.local_id}
                onToggle={() => {
                  setExpandedId((current) => current === item.receivable.local_id ? null : item.receivable.local_id);
                }}
                onConfirmPayment={() => setPaymentRequest({ item, mode: 'confirm' })}
                onPartialPayment={() => setPaymentRequest({ item, mode: 'partial' })}
                onViewTransaction={() => setSelectedTransaction(item.transaction)}
              />
            ))}
          </div>
        )}
      </section>

      <CreditPaymentSheet request={paymentRequest} onClose={() => setPaymentRequest(null)} />
      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
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


function SummaryPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-[88px] bg-secondary/70 rounded-2xl px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">{label}</p>
      <p className={cn('text-xs font-black tabular-nums truncate', danger ? 'text-red-600' : 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}

function CreditCompactRow({
  item,
  isExpanded,
  onToggle,
  onConfirmPayment,
  onPartialPayment,
  onViewTransaction,
}: {
  item: CreditHistoryItem;
  isExpanded: boolean;
  onToggle: () => void;
  onConfirmPayment: () => void;
  onPartialPayment: () => void;
  onViewTransaction: () => void;
}) {
  const status = statusLabel(item);

  return (
    <div className="group">
      <div className="flex items-center justify-between py-4 transition-colors active:bg-secondary/40 rounded-2xl px-1">
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-active:scale-95",
            item.receivable.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 
            item.isOverdue ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
          )}>
            <WalletCards size={20} strokeWidth={2.5} />
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-black text-[15px] tracking-tight truncate">{item.customerName}</p>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex-shrink-0 tracking-tighter',
                  item.receivable.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : item.isOverdue
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                )}
              >
                {status}
              </span>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              {item.sourceName} • {shortDate(item.transaction.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mb-0.5">Balance</p>
            <p className="text-[15px] font-black tabular-nums tracking-tighter">{money(item.balance)}</p>
          </div>
          <Touchable
            onPress={onToggle}
            className="w-10 h-10 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground"
          >
            <ChevronDown
              size={18}
              className={cn('transition-transform duration-300', isExpanded && 'rotate-180')}
            />
          </Touchable>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <SummaryPill label="Owed" value={money(item.amountOwed)} />
                <SummaryPill label="Paid" value={money(item.amountPaid)} />
                <SummaryPill label="Balance" value={money(item.balance)} danger={item.isOverdue} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Touchable
                  onPress={onConfirmPayment}
                  disabled={item.balance <= 0}
                  className="bg-primary text-white rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-40"
                >
                  <CheckCircle2 size={15} /> Confirm
                </Touchable>
                <Touchable
                  onPress={onPartialPayment}
                  disabled={item.balance <= 0}
                  className="bg-secondary text-primary rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-40"
                >
                  <WalletCards size={15} /> Partial
                </Touchable>
                <Touchable
                  onPress={onViewTransaction}
                  className="bg-secondary text-muted-foreground rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <ReceiptText size={15} /> Receipt
                </Touchable>
                <Touchable
                  onPress={onViewTransaction}
                  className="bg-secondary text-muted-foreground rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <FileText size={15} /> Transaction
                </Touchable>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreditPaymentSheet({
  request,
  onClose,
}: {
  request: { item: CreditHistoryItem; mode: 'confirm' | 'partial' } | null;
  onClose: () => void;
}) {
  const item = request?.item || null;
  const isConfirmMode = request?.mode === 'confirm';
  const [amount, setAmount] = useState('');
  const [payment_method, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    setAmount('');
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setNote('');
    onClose();
  };

  const submit = async () => {
    if (!item) return;
    const value = isConfirmMode ? item.balance : Number(amount);
    if (value <= 0) return;
    setIsSubmitting(true);
    try {
      const payload = {
        receivableId: item.receivable.local_id,

        amount: value,
        payment_method,
        paymentDate: new Date(paymentDate),
        note,
      };
      if (isConfirmMode) {
        await creditService.confirmCreditPayment(payload);
      } else {
        await creditService.recordPartialCreditPayment(payload);
      }
      alert('Credit payment recorded');
      close();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={Boolean(item)}
      onClose={close}
      title={isConfirmMode ? 'Confirm Payment' : 'Partial Payment'}
      dismissible={false}
    >
      {item && (
        <div className="space-y-5 py-4 pb-2">
          <div className="bg-secondary/60 rounded-[24px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-black">{money(item.balance)}</p>
          </div>

          <div className="space-y-3">
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isConfirmMode}
              placeholder={isConfirmMode ? money(item.balance) : `Amount paid (${money(item.balance)} max)`}
              className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'transfer'] as const).map((method) => (
                <Touchable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={cn(
                    'p-4 rounded-2xl border-2 text-xs font-bold uppercase tracking-widest',
                    payment_method === method
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-secondary border-transparent text-muted-foreground'
                  )}
                >
                  {method}
                </Touchable>
              ))}
            </div>
            <input
              type="datetime-local"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <Touchable
            onPress={submit}
            disabled={isSubmitting}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center disabled:opacity-50"
          >
            {isSubmitting ? 'Recording...' : isConfirmMode ? 'Confirm Full Payment' : 'Record Partial Payment'}
          </Touchable>
        </div>
      )}
    </BottomSheet>
  );
}
