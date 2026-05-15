'use client';

import { FileText, Share2, RotateCcw, Edit3, History } from 'lucide-react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import type { Transaction } from '@/db/schema';
import { cn } from '@/lib/utils';

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
  return [
    'Kola Receipt',
    `Transaction ID: ${transaction.local_id}`,
    `Type: ${transaction.type}`,
    `Amount: ${money(transaction.amount)}`,
    `Payment: ${transaction.payment_method}`,
    `Date: ${formatFullTransactionDate(transaction.created_at)}`,
    transaction.customer_name ? `Customer: ${transaction.customer_name}` : '',

    transaction.note ? `Note: ${transaction.note}` : '',
  ].filter(Boolean).join('\n');
}

function printReceipt(transaction: any) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=390,height=640');
  if (!popup) return;

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
        <div class="row"><span class="label">Type</span><span class="value">${transaction.type}</span></div>
        <div class="row"><span class="label">Amount</span><span class="value">${money(transaction.amount)}</span></div>
        <div class="row"><span class="label">Payment</span><span class="value">${transaction.payment_method}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${formatFullTransactionDate(transaction.created_at)}</span></div>
        ${transaction.customer_name ? `<div class="row"><span class="label">Customer</span><span class="value">${transaction.customer_name}</span></div>` : ''}

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
  const handleShare = async () => {
    if (!transaction) return;
    const text = receiptText(transaction);
    if (navigator.share) {
      await navigator.share({ title: 'Kola Receipt', text });
      return;
    }
    await navigator.clipboard?.writeText(text);
    alert('Receipt copied to clipboard');
  };

  const isRecent = transaction ? (new Date().getTime() - new Date(transaction.created_at).getTime()) < 24 * 60 * 60 * 1000 : false;
  const canModify = transaction && !transaction.is_reversed && isRecent;


  return (
    <BottomSheet isOpen={Boolean(transaction)} onClose={onClose} title="Transaction Info">
      {transaction && (
        <div className="space-y-5 py-4 pb-2">
          {transaction.is_reversed && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
              <p className="text-red-500 text-xs font-bold uppercase tracking-widest">Reversed Transaction</p>
              <p className="text-[10px] text-red-500/80 font-medium mt-1">{transaction.reversal_reason}</p>
            </div>
          )}



          <div className="bg-secondary/60 rounded-[24px] p-4 space-y-3">
            <InfoRow label="Status" value={transaction.status} color={transaction.is_reversed ? 'text-red-500' : transaction.is_edited ? 'text-amber-500' : ''} />
            <InfoRow label="Type" value={transaction.type} />

            <InfoRow label="Amount" value={money(transaction.amount)} />
            <InfoRow label="Payment Method" value={transaction.payment_method} />
            <InfoRow label="Transaction Date" value={formatFullTransactionDate(transaction.created_at)} />
            {transaction.customer_name && <InfoRow label="Customer" value={transaction.customer_name} />}

            {transaction.note && <InfoRow label="Note" value={transaction.note} />}
          </div>


          <div className="grid grid-cols-2 gap-3">
            <Touchable
              onPress={handleShare}
              className="bg-secondary text-foreground rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-border"
            >
              <Share2 size={16} /> Share
            </Touchable>
            <Touchable
              onPress={() => printReceipt(transaction)}
              className="bg-secondary text-foreground rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-border"
            >

              <FileText size={16} /> PDF
            </Touchable>
          </div>

          {canModify && (
            <div className="grid grid-cols-2 gap-3">
              <Touchable
                onPress={() => onReverse?.(transaction)}
                className="bg-red-500/10 text-red-600 rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-red-500/20"
              >
                <RotateCcw size={16} /> Reverse
              </Touchable>
              <Touchable
                onPress={() => onCorrect?.(transaction)}
                className="bg-amber-500/10 text-amber-600 rounded-2xl py-4 flex items-center justify-center gap-2 text-xs font-bold border border-amber-500/20"
              >
                <Edit3 size={16} /> Correct
              </Touchable>
            </div>
          )}

          {(transaction.is_edited || transaction.is_reversed) && onViewAuditTrail && (
            <Touchable
              onPress={() => onViewAuditTrail(transaction)}
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