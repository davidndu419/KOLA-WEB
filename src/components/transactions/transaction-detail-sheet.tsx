'use client';

import { FileText, Share2, RotateCcw, Edit3, History } from 'lucide-react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import type { Transaction } from '@/db/schema';
import { cn } from '@/lib/utils';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';
import { enrichTransactionsForDisplay, getTransactionTitle, type DisplayTransaction } from '@/services/transactionDisplay';

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

function money(value: number) {
  return currency.format(value || 0).replace('NGN', 'NGN ');
}

export function formatFullTransactionDate(date: any) {
  // Use 'any' for date to handle string/date object flexibility during sync
  const d = new Date(date);
  return d.toLocaleString('en-NG', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function receiptText(transaction: any) {
  const isRestock = transaction.source_type === 'restock';
  return [
    'Kola Receipt',
    `Transaction ID: ${transaction.local_id}`,
    `Type: ${isRestock ? 'Restock' : transaction.type}`,
    `Amount: ${money(transaction.amount)}`,
    `Payment: ${transaction.payment_method}`,
    `Date: ${formatFullTransactionDate(transaction.created_at)}`,
    transaction.customer_name ? `Customer: ${transaction.customer_name}` : '',
    isRestock ? 'Category: Inventory Purchase' : transaction.category_name ? `Category: ${transaction.category_name}` : '',
    transaction.service_name ? `Service: ${transaction.service_name}` : '',
    transaction.items?.length ? `Items: ${transaction.items.map((item: any) => `${item.name} x${item.quantity}`).join(', ')}` : '',
    transaction.note ? `Note: ${transaction.note}` : '',
  ].filter(Boolean).join('\n');
}

function printReceipt(transaction: any) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=390,height=640');
  if (!popup) return;
  const isRestock = transaction.source_type === 'restock';

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Kola Receipt</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111827; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          .muted { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
          .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
          .value { font-weight: 800; text-align: right; }
          button { padding: 10px 14px; border: 0; border-radius: 12px; background: #10b981; color: white; font-weight: 800; margin-bottom: 20px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Save as PDF</button>
        <h1>Kola Receipt</h1>
        <p class="muted">${transaction.local_id}</p>
        <div class="row"><span class="label">Type</span><span class="value">${isRestock ? 'Restock' : transaction.type}</span></div>
        ${isRestock ? `<div class="row"><span class="label">Category</span><span class="value">Inventory Purchase</span></div>` : ''}
        ${!isRestock && transaction.category_name ? `<div class="row"><span class="label">Category</span><span class="value">${transaction.category_name}</span></div>` : ''}
        ${transaction.service_name ? `<div class="row"><span class="label">Service</span><span class="value">${transaction.service_name}</span></div>` : ''}
        <div class="row"><span class="label">Amount</span><span class="value">${money(transaction.amount)}</span></div>
        <div class="row"><span class="label">Payment</span><span class="value">${transaction.payment_method}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${formatFullTransactionDate(transaction.created_at)}</span></div>
        ${transaction.customer_name ? `<div class="row"><span class="label">Customer</span><span class="value">${transaction.customer_name}</span></div>` : ''}
        ${transaction.items?.length ? `<h2 style="font-size:14px;margin:20px 0 6px;">Items Sold</h2>${transaction.items.map((item: any) => `<div class="row"><span class="label">${item.quantity} x ${item.name}</span><span class="value">${money(item.total_price || item.quantity * item.unit_price)}</span></div>`).join('')}` : ''}

        ${transaction.note ? `<div class="row"><span class="label">Note</span><span class="value">${transaction.note}</span></div>` : ''}
      </body>
    </html>
  `);
  popup.document.close();
}

export function TransactionDetailSheet({
  transaction,
  onClose,
  onReverse,
  onCorrect,
  onViewAuditTrail
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onReverse?: (tx: Transaction) => void;
  onCorrect?: (tx: Transaction) => void;
  onViewAuditTrail?: (tx: Transaction) => void;
}) {
  const detailTransaction = useStableLiveQuery<DisplayTransaction | null>(
    () => transaction ? enrichTransactionsForDisplay([transaction]).then(([item]) => item || null) : undefined,
    [transaction?.local_id, transaction?.updated_at],
    null
  );

  const displayTransaction = detailTransaction?.local_id === transaction?.local_id
    ? detailTransaction
    : (transaction as DisplayTransaction | null);

  const handleShare = async () => {
    if (!displayTransaction) return;
    const text = receiptText(displayTransaction);
    if (navigator.share) {
      await navigator.share({ title: 'Kola Receipt', text });
      return;
    }
    await navigator.clipboard?.writeText(text);
    alert('Receipt copied to clipboard');
  };

  const isRecent = displayTransaction ? (new Date().getTime() - new Date(displayTransaction.created_at).getTime()) < 24 * 60 * 60 * 1000 : false;
  const canModify = displayTransaction && !displayTransaction.is_reversed && isRecent;


  return (
    <BottomSheet isOpen={Boolean(transaction)} onClose={onClose} title="Transaction Info">
      {displayTransaction && (
        <div className="space-y-5 py-4 pb-2">
          {displayTransaction.is_reversed && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-red-500 text-xs font-bold uppercase tracking-widest">Reversed Transaction</p>
              <p className="text-[10px] text-red-500/80 font-medium mt-1">{displayTransaction.reversal_reason}</p>
            </div>
          )}



          <div className="bg-secondary/60 rounded-[24px] p-4 space-y-3">
            <InfoRow label="Status" value={displayTransaction.status} color={displayTransaction.is_reversed ? 'text-red-500' : displayTransaction.is_edited ? 'text-amber-500' : ''} />
            <InfoRow label="Type" value={displayTransaction.source_type === 'restock' ? 'Restock' : displayTransaction.type} />
            <InfoRow label="Title" value={getTransactionTitle(displayTransaction)} />
            {displayTransaction.source_type === 'restock' && <InfoRow label="Category" value="Inventory Purchase" />}
            {displayTransaction.source_type !== 'restock' && displayTransaction.category_name && <InfoRow label="Category" value={displayTransaction.category_name} />}
            {displayTransaction.type === 'service' && displayTransaction.service_name && <InfoRow label="Service" value={displayTransaction.service_name} />}

            <InfoRow label="Amount" value={money(displayTransaction.amount)} />
            <InfoRow label="Payment Method" value={displayTransaction.payment_method} />
            <InfoRow label="Transaction Date" value={formatFullTransactionDate(displayTransaction.created_at)} />
            {displayTransaction.customer_name && <InfoRow label="Customer" value={displayTransaction.customer_name} />}

            {displayTransaction.note && <InfoRow label="Note" value={displayTransaction.note} />}
          </div>

          {displayTransaction.type === 'sale' && displayTransaction.items && displayTransaction.items.length > 0 && (
            <div className="bg-secondary/40 rounded-[24px] p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Items Sold</p>
              <div className="space-y-3">
                {displayTransaction.items.map((item) => {
                  const lineTotal = item.total_price || item.quantity * item.unit_price;
                  const customPrice = item.original_price !== undefined && item.original_price !== item.unit_price;
                  return (
                    <div key={item.local_id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate">{item.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {item.quantity} x {money(item.unit_price)}
                            {customPrice ? ' | Custom price' : ''}
                          </p>
                        </div>
                        <p className="text-sm font-black tabular-nums">{money(lineTotal)}</p>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                        Cost: {money(item.cost || 0)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          <div className="grid grid-cols-2 gap-3">
            <Touchable
              onPress={handleShare}
              className="bg-secondary text-foreground rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-border"
            >
              <Share2 size={16} /> Share
            </Touchable>
            <Touchable
              onPress={() => printReceipt(displayTransaction)}
              className="bg-secondary text-foreground rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-border"
            >

              <FileText size={16} /> PDF
            </Touchable>
          </div>

          {canModify && (
            <div className="grid grid-cols-2 gap-3">
              <Touchable
                onPress={() => onReverse?.(displayTransaction)}
                className="bg-red-500/10 text-red-600 rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-red-500/20"
              >
                <RotateCcw size={16} /> Reverse
              </Touchable>
              <Touchable
                onPress={() => onCorrect?.(displayTransaction)}
                className="bg-amber-500/10 text-amber-600 rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-amber-500/20"
              >
                <Edit3 size={16} /> Correct
              </Touchable>
            </div>
          )}

          {(displayTransaction.is_edited || displayTransaction.is_reversed) && onViewAuditTrail && (
            <Touchable
              onPress={() => onViewAuditTrail(displayTransaction)}
              className="w-full bg-indigo-500/10 text-indigo-600 rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-indigo-500/20"
            >

              <History size={16} /> View Audit Trail
            </Touchable>
          )}

        </div>
      )}
    </BottomSheet>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string, color?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold text-right capitalize", color)}>{value}</p>
    </div>
  );
}
