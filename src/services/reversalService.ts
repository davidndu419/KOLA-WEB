import { db, createBaseEntity } from '@/db/dexie';
import { LedgerEntry, InventoryMovement } from '@/db/schema';
import { syncQueueService } from './syncQueueService';
import { assertBalanced, assertCashSolvencyForEntries } from '@/accounting/guards';
import { assertWithinModificationWindow } from './transactionModificationGuards';
import { getCurrentAuthenticatedUserId } from '@/lib/auth-user';

export const reversalService = {
  async reverseTransaction(transaction_id: string, reason: string, business_id: string) {
    const transaction = await db.transactions.where('local_id').equals(transaction_id).first();
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'reversed' || transaction.is_reversed) throw new Error('Transaction already reversed');
    assertWithinModificationWindow(transaction.created_at);
    const userId = await getCurrentAuthenticatedUserId();

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
        is_reversed: true,
        reversed_at: new Date(),
        reversal_reason: reason,
        updated_at: new Date(),
        sync_status: 'pending' as const
      };
      await db.transactions.update(transaction.id!, updatedTx);
      await syncQueueService.enqueue('transactions', 'update', updatedTx, business_id);

      // 2. Reverse Ledger Entries
      const originalEntries = await db.ledger_entries.where('transaction_id').equals(transaction_id).toArray();
      const reversalEntries: LedgerEntry[] = originalEntries.map((entry: any) => ({
    ...createBaseEntity(business_id),
        transaction_id: transaction_id,
        source_type: entry.source_type,
        source_id: entry.source_id,
        debit_account: entry.credit_account, 
        credit_account: entry.debit_account, 
        amount: entry.amount,
        is_reversal: true,
        is_correction: false,
        reversal_of_entry_id: entry.local_id,
        description: `Reversal of: ${entry.description || 'Transaction'}`
} as any)); 

      if (reversalEntries.length > 0) {
        assertBalanced(reversalEntries);
        await assertCashSolvencyForEntries(reversalEntries, business_id);
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
            const updatedProduct = {
              ...product,
              stock: new_stock,
              updated_at: new Date(),
              sync_status: 'pending' as const
            };
            await db.products.update(product.id!, updatedProduct);
            await syncQueueService.enqueue('products', 'update', updatedProduct, business_id);

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

        const sale = await db.sales.where('local_id').equals(transaction.reference_id).first();
        if (sale) {
          const updatedSale = {
            ...sale,
            status: 'voided' as const,
            updated_at: new Date(),
            sync_status: 'pending' as const,
          };
          await db.sales.update(sale.id!, updatedSale);
          await syncQueueService.enqueue('sales', 'update', updatedSale, business_id);
        }
      }

      if (transaction.type === 'service') {
        const service = await db.services.where('local_id').equals(transaction.reference_id).first();
        if (service) {
          const updatedService = {
            ...service,
            status: 'voided' as const,
            updated_at: new Date(),
            sync_status: 'pending' as const,
          };
          await db.services.update(service.id!, updatedService);
          await syncQueueService.enqueue('services', 'update', updatedService, business_id);
        }
      }

      if (transaction.type === 'expense') {
        const expense = await db.expenses.where('local_id').equals(transaction.reference_id).first();
        if (expense) {
          const updatedExpense = {
            ...expense,
            status: 'voided' as const,
            updated_at: new Date(),
            sync_status: 'pending' as const,
          };
          await db.expenses.update(expense.id!, updatedExpense);
          await syncQueueService.enqueue('expenses', 'update', updatedExpense, business_id);
        }
      }

      // 4. Reverse Customer Debt if Credit
      if (transaction.payment_method === 'credit') {
        const receivable = await db.receivables.where('transaction_id').equals(transaction_id).first();
        if (receivable) {
          const updatedReceivable = {
            ...receivable,
            status: 'voided' as const, 
            updated_at: new Date(),
            sync_status: 'pending' as const
          };
          await db.receivables.update(receivable.id!, updatedReceivable);
          await syncQueueService.enqueue('receivables', 'update', updatedReceivable, business_id);
          
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
        sync_status: userId ? 'pending' as const : 'failed' as const,
        user_id: userId,
        action: 'reversed',
        entity_type: 'transaction',
        entity_id: transaction_id,
        reason: reason,
        old_value: transaction,
      };
      await db.audit_logs.add(auditLog as any);
      if (userId) {
        await syncQueueService.enqueue('audit_logs', 'create', auditLog, business_id);
      }

      return true;
    });
  }
};
