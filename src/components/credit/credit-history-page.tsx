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

  return (
    <div className="px-5 space-y-5">
      <header className="py-4 flex items-center gap-3">
        <Touchable
          onPress={() => router.back()}
          className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft size={20} />
        </Touchable>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground font-medium">{subtitle}</p>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <SummaryPill label="Pending" value={money(data?.summary.totalPending || 0)} />
        <SummaryPill label="Open" value={String(data?.summary.pendingCount || 0)} />
        <SummaryPill label="Paid" value={String(data?.summary.paidCount || 0)} />
        <SummaryPill
          label="Overdue"
          value={String(data?.summary.overdueCount || 0)}
          danger={(data?.summary.overdueCount || 0) > 0}
        />
      </div>

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
          <div className="bg-secondary/60 rounded-[28px] p-8 text-center text-muted-foreground font-bold">
            No {filter === 'all' ? '' : filter} credit found.
          </div>
        ) : (
          filteredHistory.map((item) => (
            <CreditCompactRow
              key={item.receivable.localId}
              item={item}
              isExpanded={expandedId === item.receivable.localId}
              onToggle={() => {
                setExpandedId((current) => current === item.receivable.localId ? null : item.receivable.localId);
              }}
              onConfirmPayment={() => setPaymentRequest({ item, mode: 'confirm' })}
              onPartialPayment={() => setPaymentRequest({ item, mode: 'partial' })}
              onViewTransaction={() => setSelectedTransaction(item.transaction)}
            />
          ))
        )}
      </section>

      <CreditPaymentSheet request={paymentRequest} onClose={() => setPaymentRequest(null)} />
      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
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
    <div className="bg-card border border-border/60 shadow-md shadow-black/5 rounded-[22px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-bold text-sm tracking-tight truncate">{item.customerName}</p>
            <span
              className={cn(
                'px-2 py-1 rounded-full text-[9px] font-black uppercase flex-shrink-0',
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
          <p className="text-xs font-black truncate">{item.sourceName}</p>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide truncate">
            {shortDate(item.transaction.createdAt)} | Due {shortDate(item.dueDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Balance</p>
            <p className="text-sm font-black tabular-nums">{money(item.balance)}</p>
          </div>
          <Touchable
            onPress={onToggle}
            className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <ChevronDown
              size={18}
              className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
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
            <div className="px-3 pb-3 space-y-3">
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
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
        receivableId: item.receivable.localId,
        amount: value,
        paymentMethod,
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
      bottomOffset={64}
    >
      {item && (
        <div className="space-y-5 py-4 pb-10">
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
                    paymentMethod === method
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
