// src/accounting/engine.ts
import { db } from '@/db/dexie';
import { Transaction, LedgerEntry } from '@/db/schema';
import { createBaseEntity } from '@/db/dexie';

/**
 * Solvency Guard: Validates that a transaction is possible.
 */
export async function validateTransaction(transaction: Partial<Transaction>) {
  if (transaction.type === 'sale' && transaction.items) {
    for (const item of transaction.items) {
      const product = await db.products.where('localId').equals(item.productId).first();
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
    }
  }
  return true;
}

/**
 * Accounting Engine: Implements the hidden double-entry system.
 */
export async function processAccounting(transaction: Transaction) {
  const entries: Omit<LedgerEntry, 'id'>[] = [];
  const base = createBaseEntity(transaction.businessId);

  // 1. Handle Cash/Receivable Side (Debit)
  if (transaction.type === 'sale' || transaction.type === 'service') {
    entries.push({
      ...base,
      localId: crypto.randomUUID(),
      transactionId: transaction.localId,
      accountName: transaction.paymentMethod === 'credit' ? 'Receivables' : 'Cash',
      debit: transaction.amount,
      credit: 0
    });

    // Handle Revenue side (Credit)
    entries.push({
      ...base,
      localId: crypto.randomUUID(),
      transactionId: transaction.localId,
      accountName: transaction.type === 'sale' ? 'Revenue' : 'Service Revenue',
      debit: 0,
      credit: transaction.amount
    });

    // Handle Inventory Side for Sales
    if (transaction.type === 'sale' && transaction.items) {
      for (const item of transaction.items) {
        const product = await db.products.where('localId').equals(item.productId).first();
        if (product) {
          const costValue = (item.cost || product.buyingPrice) * item.quantity;
          
          // Credit Inventory
          entries.push({
            ...base,
            localId: crypto.randomUUID(),
            transactionId: transaction.localId,
            accountName: 'Inventory',
            debit: 0,
            credit: costValue
          });

          // Debit COGS
          entries.push({
            ...base,
            localId: crypto.randomUUID(),
            transactionId: transaction.localId,
            accountName: 'COGS',
            debit: costValue,
            credit: 0
          });

          // Update stock
          await db.products.update(product.id!, {
            stock: product.stock - item.quantity,
            updatedAt: new Date(),
            syncStatus: 'pending'
          });
          
          // Log movement
          await db.inventory_movements.add({
            ...base,
            productId: product.localId,
            type: 'stock-out',
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: product.stock - item.quantity,
            note: `Sale: ${transaction.localId}`
          } as any);
        }
      }
    }
  }

  // 2. Handle Expenses
  if (transaction.type === 'expense') {
    // Debit Expense Account
    entries.push({
      ...base,
      localId: crypto.randomUUID(),
      transactionId: transaction.localId,
      accountName: 'Expenses',
      debit: transaction.amount,
      credit: 0
    });

    // Credit Cash
    entries.push({
      ...base,
      localId: crypto.randomUUID(),
      transactionId: transaction.localId,
      accountName: 'Cash',
      debit: 0,
      credit: transaction.amount
    });
  }

  // Bulk add to ledger
  await db.ledger_entries.bulkAdd(entries as any);
  
  // Add to sync queue for entries
  for (const entry of entries) {
    await db.sync_queue.add({
      table: 'ledger_entries',
      action: 'create',
      data: entry,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    });
  }
}
