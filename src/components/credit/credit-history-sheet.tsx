'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, FileText, ReceiptText, WalletCards } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
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

function money(value: number) {
  return currency.format(value || 0).replace('NGN', 'NGN ');
}

function shortDate(date: Date) {
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isFilterMatch(item: CreditHistoryItem, filter: CreditFilter) {
  if (filter === 'all') return true;
  if (filter === 'overdue') return item.isOverdue;
  return item.receivable.status === filter;
}

const filters: { id: CreditFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'partially-paid', label: 'Partial' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
];

export function CreditHistorySheet({
  isOpen,
  onClose,
  sourceType,
}: {
  isOpen: boolean;
  onClose: () => void;
  sourceType: CreditSourceType;
}) {
  const [filter, setFilter] = useState<CreditFilter>('all');
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

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={`${sourceType === 'sale' ? 'Sales' : 'Service'} Credit`}
        bottomOffset={64}
      >
        <div className="space-y-5 py-4 pb-10">
          <div className="grid grid-cols-4 gap-2">
            <CreditStat label="Pending" value={money(data?.summary.totalPending || 0)} wide />
            <CreditStat label="Open" value={String(data?.summary.pendingCount || 0)} />
            <CreditStat label="Paid" value={String(data?.summary.paidCount || 0)} />
            <CreditStat label="Overdue" value={String(data?.summary.overdueCount || 0)} danger={(data?.summary.overdueCount || 0) > 0} />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {filters.map((item) => (
              <Touchable
                key={item.id}
                onPress={() => setFilter(item.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide border whitespace-nowrap',
                  filter === item.id ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-transparent'
                )}
              >
                {item.label}
              </Touchable>
            ))}
          </div>

          <div className="space-y-3">
            {!data ? (
              <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading credits...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="bg-secondary/60 rounded-[28px] p-8 text-center text-muted-foreground font-bold">
                No {filter === 'all' ? '' : filter} credit found.
              </div>
            ) : (
              filteredHistory.map((item) => (
                <CreditItemCard
                  key={item.receivable.local_id}
                  item={item}
                  onConfirmPayment={() => setPaymentRequest({ item, mode: 'confirm' })}
                  onPartialPayment={() => setPaymentRequest({ item, mode: 'partial' })}
                  onViewReceipt={() => setSelectedTransaction(item.transaction)}
                  onViewTransaction={() => setSelectedTransaction(item.transaction)}
                />
              ))
            )}
          </div>
        </div>
      </BottomSheet>

      <CreditPaymentSheet
        request={paymentRequest}
        onClose={() => setPaymentRequest(null)}
      />

      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  );
}

function CreditStat({
  label,
  value,
  wide,
  danger,
}: {
  label: string;
  value: string;
  wide?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn('bg-secondary/70 rounded-2xl p-3 min-w-0', wide && 'col-span-2')}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground truncate">{label}</p>
      <p className={cn('text-xs font-black tabular-nums truncate', danger ? 'text-red-600' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function CreditItemCard({
  item,
  onConfirmPayment,
  onPartialPayment,
  onViewReceipt,
  onViewTransaction,
}: {
  item: CreditHistoryItem;
  onConfirmPayment: () => void;
  onPartialPayment: () => void;
  onViewReceipt: () => void;
  onViewTransaction: () => void;
}) {
  return (
    <div className="bg-card border border-border/60 shadow-md shadow-black/5 rounded-[24px] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {item.customerName}
          </p>
          <h3 className="text-base font-black truncate">{item.sourceName}</h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">
            {shortDate(item.transaction.created_at)} | Due {shortDate(item.due_date)}
          </p>
        </div>
        <div className={cn(
          'px-2 py-1 rounded-full text-[10px] font-black uppercase',
          item.receivable.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
          item.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        )}>
          {item.isOverdue ? 'Overdue' : item.receivable.status}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <CreditStat label="Owed" value={money(item.amountOwed)} />
        <CreditStat label="Paid" value={money(item.amountPaid)} />
        <CreditStat label="Balance" value={money(item.balance)} danger={item.balance > 0 && item.isOverdue} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Touchable
          onPress={onConfirmPayment}
          disabled={item.balance <= 0}
          className="bg-primary text-white rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-40"
        >
          <CheckCircle2 size={15} /> Confirm Payment
        </Touchable>
        <Touchable
          onPress={onPartialPayment}
          disabled={item.balance <= 0}
          className="bg-secondary text-primary rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-40"
        >
          <WalletCards size={15} /> Partial
        </Touchable>
        <Touchable
          onPress={onViewReceipt}
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
    <BottomSheet isOpen={Boolean(item)} onClose={close} title={isConfirmMode ? 'Confirm Payment' : 'Partial Payment'} bottomOffset={64}>
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
                    payment_method === method ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'
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
