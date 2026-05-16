import { db, createBaseEntity } from '@/db/dexie';
import { Sale, SaleItem, Transaction, Receivable } from '@/db/schema';
import { processAccounting, validateTransaction } from '@/accounting/engine';
import { syncQueueService } from '@/services/syncQueueService';
import { saleRepository } from '@/db/repositories/sale.repository';
import { transactionRepository } from '@/db/repositories/transaction.repository';

export const salesService = {
  async recordSale(
    data: {
      total_amount: number;
      discount_amount: number;
      tax_amount: number;
      net_amount: number;
      payment_method: 'cash' | 'transfer' | 'credit';
      items: { product_id: string; quantity: number; unit_price: number; cost: number }[];
      customer_id?: string;
      note?: string;
    },
    business_id: string
  ) {
    const base = createBaseEntity(business_id);
    const transaction_id = crypto.randomUUID();

    // 1. Create Transaction record (the master journal)
    const transaction: Transaction = {
      ...base,
      type: 'sale',
      amount: data.net_amount,
      payment_method: data.payment_method,
      status: 'completed',
      reference_id: '', // Will be updated with sale.local_id
      note: data.note,
    };

    // 2. Create Sale and SaleItems
    return await db.transaction('rw', [
      db.transactions,
      db.sales,
      db.sale_items,
      db.products,
      db.ledger_entries,
      db.receivables,
      db.customers,
      db.sync_queue,
      db.inventory_movements
    ], async () => {
      await validateTransaction({ type: 'sale' }, data.items);

      // Add Transaction
      const transactionDbId = await db.transactions.add(transaction);
      transaction.id = transactionDbId as number;
      
      // Add Sale
      const sale: Sale = {
        ...createBaseEntity(business_id),
        transaction_id: transaction.local_id,
        customer_id: data.customer_id,
        total_amount: data.total_amount,
        discount_amount: data.discount_amount,
        tax_amount: data.tax_amount,
        net_amount: data.net_amount,
        payment_method: data.payment_method,
        status: 'completed',
        note: data.note,
      };
      const saleDbId = await db.sales.add(sale);
      sale.id = saleDbId as number;
      
      // Update transaction reference
      transaction.reference_id = sale.local_id;
      await db.transactions.update(transaction.id!, { reference_id: sale.local_id });

      // Add Sale Items
      const saleItems: SaleItem[] = data.items.map(item => ({
        ...createBaseEntity(business_id),
        sale_id: sale.local_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        cost: item.cost,
      }));
      await db.sale_items.bulkAdd(saleItems);

      // Handle Credit
      if (data.payment_method === 'credit' && data.customer_id) {
        const receivable: Receivable = {
          ...createBaseEntity(business_id),
          transaction_id: transaction.local_id,
          customer_id: data.customer_id,
          amount: data.net_amount,
          paid_amount: 0,
          status: 'pending',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        };
        await db.receivables.add(receivable);
        await syncQueueService.enqueue('receivables', 'create', receivable, business_id);
      }

      // 3. Process Accounting (Ledger & Stock)
      // We pass the transaction but the engine needs to know what items to deduct
      // Refactoring processAccounting to accept items for sales
      await processAccounting(transaction, saleItems);

      // 4. Enqueue Sync
      await syncQueueService.enqueue('transactions', 'create', transaction, business_id);
      await syncQueueService.enqueue('sales', 'create', sale, business_id);
      await syncQueueService.enqueueMany(
        saleItems.map(si => ({ entity: 'sale_items', action: 'create', payload: si, business_id: business_id }))
      );

      return { transaction, sale, saleItems };
    });
  },

  async voidSale(transaction_id: string) {
    // Reversal logic
    // Implementation here
  }
};
