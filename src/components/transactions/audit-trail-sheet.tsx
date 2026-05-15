// src/components/transactions/audit-trail-sheet.tsx
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { BottomSheet } from '@/components/bottom-sheet';
import { History, PlusCircle, Edit3, RotateCcw } from 'lucide-react';
import { formatFullTransactionDate } from './transaction-detail-sheet';

export function AuditTrailSheet({
  transaction_id,
  isOpen,
  onClose
}: {
  transaction_id: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const auditLogs = useLiveQuery(async () => {
    if (!transaction_id) return [];
    return await db.audit_logs
      .where('entity_id')
      .equals(transaction_id)
      .sortBy('created_at');
  }, [transaction_id]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Transaction Audit Trail">
      <div className="space-y-6 py-4 pb-2">
        <div className="relative space-y-8 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/50">
          {auditLogs?.map((log, index) => (
            <div key={log.local_id} className="relative flex gap-4 items-start pl-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                log.action === 'created' ? 'bg-emerald-500 text-white' :
                log.action === 'corrected' ? 'bg-amber-500 text-white' :
                log.action === 'reversed' ? 'bg-red-500 text-white' : 'bg-secondary text-muted-foreground'
              }`}>
                {log.action === 'created' && <PlusCircle size={14} />}
                {log.action === 'corrected' && <Edit3 size={14} />}
                {log.action === 'reversed' && <RotateCcw size={14} />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold capitalize">{log.action}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {formatFullTransactionDate(new Date(log.created_at))}
                  </p>
                </div>
                {log.reason && (
                  <p className="text-xs font-medium text-muted-foreground bg-secondary/30 p-2 rounded-lg border border-border/50 italic">
                    "{log.reason}"
                  </p>
                )}
                {log.action === 'corrected' && log.new_value && (
                  <div className="text-[10px] font-mono text-muted-foreground bg-secondary/20 p-2 rounded-lg mt-2 overflow-x-auto">
                    <p className="font-bold text-primary/70 mb-1 uppercase tracking-tighter">New Amount: ₦{log.new_value.amount?.toLocaleString()}</p>
                    <p>Method: {log.new_value.payment_method}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!auditLogs || auditLogs.length === 0) && (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">No history found</p>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
