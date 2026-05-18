'use client';

import { FileText, Share2, RotateCcw, Edit3, History } from 'lucide-react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import type { Transaction } from '@/db/schema';
import { cn, safeTime } from '@/lib/utils';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';
import { enrichTransactionsForDisplay, getTransactionTitle, type DisplayTransaction } from '@/services/transactionDisplay';
import { useAuthStore } from '@/stores/authStore';

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
  const business = useAuthStore((state) => state.business);
  const detailTransaction = useStableLiveQuery<DisplayTransaction | null>(
    () => transaction ? enrichTransactionsForDisplay([transaction]).then(([item]) => item || null) : undefined,
    [transaction?.local_id, transaction?.updated_at],
    null
  );

  const displayTransaction = detailTransaction?.local_id === transaction?.local_id
    ? detailTransaction
    : (transaction as DisplayTransaction | null);

  const businessInfo = {
    businessName: business?.name || business?.business_name || 'Kola Business',
    businessAddress: business?.address,
  };

  const showExportError = () => {
    window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message: 'Export failed' } }));
  };

  const handleShare = async () => {
    if (!displayTransaction) return;
    try {
      const { exportService } = await import('@/services/exportService');
      await exportService.shareTransactionDetailImage(displayTransaction, businessInfo);
    } catch {
      showExportError();
    }
  };

  const handlePdf = async () => {
    if (!displayTransaction) return;
    try {
      const { exportService } = await import('@/services/exportService');
      exportService.downloadTransactionDetailPdf(displayTransaction, businessInfo);
    } catch {
      showExportError();
    }
  };

  const isRecent = displayTransaction ? (Date.now() - safeTime(displayTransaction.created_at)) < 24 * 60 * 60 * 1000 : false;
  const canModify = displayTransaction && displayTransaction.status !== 'reversed' && !displayTransaction.is_reversed && isRecent;


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
              onPress={handlePdf}
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
