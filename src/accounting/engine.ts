import { db } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement, SaleItem } from '@/db/schema';
import { createBaseEntity } from '@/db/dexie';
import { syncQueueService } from '@/services/syncQueueService';

/**
 * Accounting Engine: Implements the double-entry system.
 * Each ledger entry now represents a debit/credit pair for simplified integrity.
 */
export async function processAccounting(
  transaction: Transaction, 
  items?: SaleItem[]
) {
  const entries: Omit<LedgerEntry, 'id'>[] = [];
  const movements: Omit<InventoryMovement, 'id'>[] = [];
  const base = createBaseEntity(transaction.business_id);

  // 1. Handle Sales
  if (transaction.type === 'sale' && items) {
    // Principal Entry: Debit Cash/Receivables, Credit Revenue
    entries.push({
      ...base,
      local_id: crypto.randomUUID(),
      transaction_id: transaction.local_id,
      source_type: 'sale',
      source_id: transaction.reference_id,
      debit_account: transaction.payment_method === 'credit' ? 'Receivables' : 'Cash',
      credit_account: 'Revenue',
      amount: transaction.amount,
      is_reversal: false,
      is_correction: false,
      description: `Sale: ${transaction.local_id}`
    });


    // COGS & Inventory Entry
    for (const item of items) {
      const product = await db.products.where('local_id').equals(item.product_id).first();
      if (product) {
        // WAC Foundation: Use wac_price if available, otherwise fallback to item.cost or latest buying_price
        const costBasis = product.wac_price ?? item.cost ?? product.buying_price ?? 0;
        const costValue = costBasis * item.quantity;
        
        entries.push({
          ...base,
          local_id: crypto.randomUUID(),
          transaction_id: transaction.local_id,
          source_type: 'sale',
          source_id: transaction.reference_id,
          debit_account: 'COGS',
          credit_account: 'Inventory',
          amount: costValue,
          is_reversal: false,
          is_correction: false,
          description: `COGS for ${product.name}`
        });

        // Update stock
        await db.products.update(product.id!, {
          stock: product.stock - item.quantity,
          updated_at: new Date(),
          sync_status: 'pending'
        });

        // Log movement
        movements.push({
          ...base,
          local_id: crypto.randomUUID(),
          product_id: product.local_id,
          type: 'stock-out',
          quantity: item.quantity,
          previous_stock: product.stock,
          new_stock: product.stock - item.quantity,
          note: `Sale: ${transaction.local_id}`,
          status: 'active'
        });
      }
    }
  }

  // 2. Handle Services
  if (transaction.type === 'service') {
    entries.push({
      ...base,
      local_id: crypto.randomUUID(),
      transaction_id: transaction.local_id,
      source_type: 'service',
      source_id: transaction.reference_id,
      debit_account: transaction.payment_method === 'credit' ? 'Receivables' : 'Cash',
      credit_account: 'Service Revenue',
      amount: transaction.amount,
      is_reversal: false,
      is_correction: false,
      description: `Service: ${transaction.local_id}`
    });

  }

  // 3. Handle Expenses
  if (transaction.type === 'expense') {
    entries.push({
      ...base,
      local_id: crypto.randomUUID(),
      transaction_id: transaction.local_id,
      source_type: 'expense',
      source_id: transaction.reference_id,
      debit_account: 'Expenses',
      credit_account: 'Cash',
      amount: transaction.amount,
      is_reversal: false,
      is_correction: false,
      description: `Expense: ${transaction.local_id}`
    });

  }

  // 4. Handle Credit Payments
  if (transaction.type === 'credit_payment') {
    entries.push({
      ...base,
      local_id: crypto.randomUUID(),
      transaction_id: transaction.local_id,
      source_type: 'credit_payment',
      source_id: transaction.reference_id,
      debit_account: 'Cash',
      credit_account: 'Receivables',
      amount: transaction.amount,
      is_reversal: false,
      is_correction: false,
      description: `Credit Payment: ${transaction.local_id}`
    });

  }

  // Perform bulk operations
  if (entries.length > 0) {
    await db.ledger_entries.bulkAdd(entries as LedgerEntry[]);
    await syncQueueService.enqueueMany(
      entries.map(e => ({ entity: 'ledger_entries', action: 'create', payload: e, business_id: transaction.business_id }))
    );
  }

  if (movements.length > 0) {
    await db.inventory_movements.bulkAdd(movements as InventoryMovement[]);
    await syncQueueService.enqueueMany(
      movements.map(m => ({ entity: 'inventory_movements', action: 'create', payload: m, business_id: transaction.business_id }))
    );
  }

}

/**
 * Solvency Guard: Validates that a transaction is possible.
 */
export async function validateTransaction(transaction: Partial<Transaction>, items?: any[]) {
  if (transaction.type === 'sale' && items) {
    for (const item of items) {
      const product = await db.products.where('local_id').equals(item.product_id).first();
      if (!product) throw new Error(`Product not found: ${item.product_id}`);
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
    }
  }
  return true;
}
