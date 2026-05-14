import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement, SaleItem } from '@/db/schema';
import { syncQueueService } from './syncQueueService';

export const reversalService = {
  async reverseTransaction(transaction_id: string, reason: string, business_id: string) {
    const transaction = await db.transactions.where('local_id').equals(transaction_id).first();
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'reversed') throw new Error('Transaction already reversed');

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
      // 1. Mark original transaction as reversed
      const updatedTx = {
        ...transaction,
        status: 'reversed' as const,
        updated_at: new Date(),
        sync_status: 'pending' as const
      };
      await db.transactions.update(transaction.id!, updatedTx);
      await syncQueueService.enqueue('transactions', 'update', updatedTx, business_id);

      // 2. Reverse Ledger Entries
      const originalEntries = await db.ledger_entries.where('transaction_id').equals(transaction_id).toArray();
      const reversalEntries: LedgerEntry[] = originalEntries.map(entry => ({
        ...createBaseEntity(business_id),
        transaction_id: transaction_id,
        source_type: entry.source_type,
        source_id: entry.source_id,
        debit_account: entry.credit_account, // Swap
        credit_account: entry.debit_account, // Swap
        amount: entry.amount,
        is_reversal: true,
        is_correction: false,
        description: `Reversal of: ${entry.description || 'Transaction'}`
      } as any));

      if (reversalEntries.length > 0) {
        await db.ledger_entries.bulkAdd(reversalEntries);
        await syncQueueService.enqueueMany(
          reversalEntries.map(e => ({ entity: 'ledger_entries', action: 'create', payload: e, business_id: business_id }))
        );
      }

      // 3. Reverse Inventory if Sale
      if (transaction.type === 'sale') {
        const saleItems = await db.sale_items.where('sale_id').equals(transaction.reference_id).toArray();
        for (const item of saleItems) {
          const product = await db.products.where('local_id').equals(item.product_id).first();
          if (product) {
            const new_stock = product.stock + item.quantity;
            await db.products.update(product.id!, { 
              stock: new_stock,
              updated_at: new Date(),
              sync_status: 'pending'
            });

            const movement: InventoryMovement = {
              ...createBaseEntity(business_id),
              product_id: item.product_id,
              type: 'return',
              quantity: item.quantity,
              previous_stock: product.stock,
              new_stock: new_stock,
              note: `Reversal: ${transaction_id}`,
              status: 'active'
            };
            await db.inventory_movements.add(movement);
            await syncQueueService.enqueue('inventory_movements', 'create', movement, business_id);
          }
        }
      }

      // 4. Reverse Customer Debt if Credit
      if (transaction.payment_method === 'credit') {
        const receivable = await db.receivables.where('transaction_id').equals(transaction_id).first();
        if (receivable) {
          await db.receivables.update(receivable.id!, { 
            status: 'voided', 
            updated_at: new Date(),
            sync_status: 'pending'
          });
          
          const customer = await db.customers.where('local_id').equals(receivable.customer_id).first();
          if (customer) {
            const updatedCustomer = {
              ...customer,
              total_debt: Math.max(0, (customer.total_debt || 0) - (receivable.amount - receivable.paid_amount)),
              updated_at: new Date(),
              sync_status: 'pending' as const
            };
            await db.customers.update(customer.id!, updatedCustomer);
            await syncQueueService.enqueue('customers', 'update', updatedCustomer, business_id);
          }
        }
      }

      // 5. Create Audit Log
      const auditLog = {
        ...createBaseEntity(business_id),
        user_id: 'local_user',
        action: 'reversed',
        entity_type: 'transaction',
        entity_id: transaction_id,
        reason: reason,
        old_value: transaction,
      };
      await db.audit_logs.add(auditLog as any);
      await syncQueueService.enqueue('audit_logs', 'create', auditLog, business_id);

      return true;
    });
  }
};
