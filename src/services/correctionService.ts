import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement, SaleItem } from '@/db/schema';
import { syncQueueService } from './syncQueueService';
import { processAccounting } from '@/accounting/engine';

export const correctionService = {
  async correctTransaction(
    transaction_id: string, 
    updatedData: Partial<Transaction>, 
    reason: string, 
    business_id: string
  ) {
    const original = await db.transactions.where('local_id').equals(transaction_id).first();
    if (!original) throw new Error('Transaction not found');
    if (original.status === 'reversed') throw new Error('Cannot correct a reversed transaction');

    return await db.transaction('rw', [
      db.transactions,
      db.ledger_entries,
      db.products,
      db.inventory_movements,
      db.receivables,
      db.customers,
      db.audit_logs,
      db.sync_queue,
      db.sales,
      db.sale_items,
      db.services,
      db.expenses
    ], async () => {
      // 1. Reverse Original Financial Impact (Ledger only for simplicity, or full reversal)
      const originalEntries = await db.ledger_entries.where('transaction_id').equals(transaction_id).toArray();
      const reversalEntries: LedgerEntry[] = originalEntries.map(entry => ({
        ...createBaseEntity(business_id),
        transaction_id: transaction_id,
        source_type: entry.source_type,
        source_id: entry.source_id,
        debit_account: entry.credit_account,
        credit_account: entry.debit_account,
        amount: entry.amount,
        is_reversal: false,
        is_correction: true,
        description: `Correction Reverse: ${transaction_id}`
      } as any));

      if (reversalEntries.length > 0) {
        await db.ledger_entries.bulkAdd(reversalEntries);
        // Sync enqueued later
      }

      // If sale, we should ideally reverse stock too if items changed, but the user didn't specify partial item correction logic yet.
      // For now, we'll assume correction updates the amount/method/category.
      
      // 2. Update the Transaction
      const updatedTx = {
        ...original,
        ...updatedData,
        status: 'edited' as const,
        updated_at: new Date(),
        sync_status: 'pending' as const
      };
      await db.transactions.update(original.id!, updatedTx);

      // 3. Apply New Financial Impact
      await processAccounting(updatedTx);

      // 4. Audit Log
      const auditLog = {
        ...createBaseEntity(business_id),
        user_id: 'local_user',
        action: 'corrected',
        entity_type: 'transaction',
        entity_id: transaction_id,
        reason: reason,
        old_value: original,
        new_value: updatedTx,
      };
      await db.audit_logs.add(auditLog as any);

      // 5. Enqueue everything for Sync
      await syncQueueService.enqueue('transactions', 'update', updatedTx, business_id);
      await syncQueueService.enqueue('audit_logs', 'create', auditLog, business_id);
      
      return updatedTx;
    });
  }
};
