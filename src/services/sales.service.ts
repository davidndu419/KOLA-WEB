// src/services/sales.service.ts
import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, TransactionItem, Receivable } from '@/db/schema';
import { processAccounting, validateTransaction } from '@/accounting/engine';

export const salesService = {
  async recordSale(
    data: {
      amount: number;
      paymentMethod: 'cash' | 'transfer' | 'credit';
      items: TransactionItem[];
      customerId?: string;
      customerName?: string;
      note?: string;
    },
    businessId: string
  ) {
    const base = createBaseEntity(businessId);
    
    // Enrich items with current cost price for COGS calculation
    const enrichedItems = await Promise.all(
      data.items.map(async (item) => {
        const product = await db.products.where('localId').equals(item.productId).first();
        return {
          ...item,
          cost: product?.buyingPrice || 0
        };
      })
    );

    const transaction: Transaction = {
      ...base,
      type: 'sale',
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      status: 'completed',
      customerId: data.customerId,
      customer: data.customerName,
      items: enrichedItems,
      note: data.note,
    };

    // 1. Validate (Solvency Guard)
    await validateTransaction(transaction);

    // 2. Perform DB Transaction
    return await db.transaction('rw', [
      db.transactions, 
      db.products, 
      db.ledger_entries, 
      db.receivables, 
      db.customers, 
      db.sync_queue,
      db.inventory_movements
    ], async () => {
      // Add Transaction
      await db.transactions.add(transaction);

      // Handle Credit Sale (Create Receivable)
      if (data.paymentMethod === 'credit' && data.customerId) {
        const receivableBase = createBaseEntity(businessId);
        const receivable: Receivable = {
          ...receivableBase,
          transactionId: transaction.localId,
          customerId: data.customerId,
          amount: data.amount,
          paidAmount: 0,
          status: 'pending'
        };
        await db.receivables.add(receivable);
        
        // Update customer total debt
        const customer = await db.customers.where('localId').equals(data.customerId).first();
        if (customer) {
          await db.customers.update(customer.id!, {
            totalDebt: (customer.totalDebt || 0) + data.amount,
            updatedAt: new Date()
          });
        }
      }

      // 3. Process Accounting (Ledger & Stock)
      await processAccounting(transaction);

      // 4. Add to sync queue
      await db.sync_queue.add({
        table: 'transactions',
        action: 'create',
        data: transaction,
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending'
      });

      return transaction;
    });
  },

  async voidSale(transactionId: string) {
    // Implementation for reversing a sale (restoring stock, reversing ledger)
    // TODO: Implement reversal logic
  }
};
