import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement } from '@/db/schema';

/**
 * FIXED: Standalone function for Sale Validation
 */
async function validateSaleCorrection(original: Transaction, updated: Partial<Transaction>) {
 const updatedTx = updated as any;
if (!updatedTx.items) return;

for (const item of updatedTx.items) {
    const product = await db.products.where('local_id').equals(item.product_id).first();
    if (!product) continue;

    const originalItem = original.items?.find((i: { product_id: any; }) => i.product_id === item.product_id);
    const originalQty = originalItem?.quantity || 0;
    
    // Stock Validation Formula: Current Stock + Original Sold Quantity >= New Sold Quantity
    if (product.stock + originalQty < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
  }
}

/**
 * FIXED: Standalone function for Reversing Financial Impact
 */
async function reverseFinancialImpact(transaction: Transaction, business_id: string) {
  // Ledgers
  const entries = await db.ledger_entries.where('transaction_id').equals(transaction.local_id).toArray();
  for (const entry of entries as any[]) {
  await db.ledger_entries.add({
    ...createBaseEntity(business_id),
    transaction_id: transaction.local_id,
    account_name: entry.account_name,
    debit: entry.credit,
    credit: entry.debit,
    isCorrection: true,
    reversal_of_entry_id: entry.local_id
  } as any);
}

  // Inventory (if sale)
  if (transaction.type === 'sale' && transaction.items) {
    for (const item of transaction.items) {
      const product = await db.products.where('local_id').equals(item.product_id).first();
      if (product) {
        const new_stock = product.stock + item.quantity;
        await db.products.update(product.id!, { stock: new_stock });
        await db.inventory_movements.add({
          ...createBaseEntity(business_id),
          product_id: item.product_id,
          type: 'return',
          quantity: item.quantity,
          previous_stock: product.stock,
          new_stock,
          reason: `Correction Reverse: ${transaction.local_id}`
        });
      }
    }
  }

  // Receivables (if credit)
  if (transaction.payment_method === 'credit') {
    const rec = await db.receivables.where('transaction_id').equals(transaction.local_id).first();
    if (rec) {
      await db.receivables.update(rec.id!, { status: 'voided' });
    }
  }
}

/**
 * FIXED: Standalone function for Applying New Impact
 */
async function applyFinancialImpact(transaction: Transaction, business_id: string) {
  if (transaction.type === 'sale' && transaction.items) {
    for (const item of transaction.items) {
      const product = await db.products.where('local_id').equals(item.product_id).first();
      if (product) {
        const new_stock = product.stock - item.quantity;
        await db.products.update(product.id!, { stock: new_stock });
        await db.inventory_movements.add({
          ...createBaseEntity(business_id),
          product_id: item.product_id,
          type: 'stock-out',
          quantity: item.quantity,
          previous_stock: product.stock,
          new_stock,
          reason: `Correction Apply: ${transaction.local_id}`
        });
      }
    }

    // Ledger Entries
    const account_name = transaction.payment_method === 'cash' ? 'Cash' : 
                        transaction.payment_method === 'transfer' ? 'Bank' : 'Receivables';
    
   await db.ledger_entries.add({
  ...createBaseEntity(business_id),
  transaction_id: transaction.local_id,
  account_name: 'Cash', // Or your dynamic account variable
  debit: transaction.amount,
  credit: 0,
  isCorrection: true,
} as any);

await db.ledger_entries.add({
  ...createBaseEntity(business_id),
  transaction_id: transaction.local_id,
  account_name: 'Sales Revenue',
  debit: 0,
  credit: transaction.amount,
  isCorrection: true,
} as any);

    // COGS
    let totalCOGS = 0;
    for (const item of transaction.items) {
      const product = await db.products.where('local_id').equals(item.product_id).first();
      if (product) totalCOGS += (product.buying_price * item.quantity);
    }

    // For COGS and Inventory entries
await db.ledger_entries.add({
  ...createBaseEntity(business_id),
  transaction_id: transaction.local_id,
  account_name: 'COGS',
  debit: totalCOGS,
  credit: 0,
  isCorrection: true
} as any);

await db.ledger_entries.add({
  ...createBaseEntity(business_id),
  transaction_id: transaction.local_id,
  account_name: 'Inventory',
  debit: 0,
  credit: totalCOGS,
  isCorrection: true
} as any);

// For Receivables (Credit Sales)
if (transaction.payment_method === 'credit') {
  await db.receivables.add({
    ...createBaseEntity(business_id),
    transaction_id: transaction.local_id,
    customer_id: (transaction as any).customer_id || '',
    amount: transaction.amount,
    paid_amount: 0,
    status: 'pending'
  } as any);
} 
    }
  }
 


/**
 * MAIN EXPORTED SERVICE
 */
export const CorrectionService = {
  async correctTransaction(transaction_id: string, updatedData: Partial<Transaction>, reason: string, business_id: string, userId: string) {
    const original = await db.transactions.where('local_id').equals(transaction_id).first();
    if (!original) throw new Error('Transaction not found');
    if (original.status === 'reversed') throw new Error('Cannot correct a reversed transaction');

    // 1. Validate
    if (original.type === 'sale') {
      await validateSaleCorrection(original, updatedData);
    }

    // 2. Reverse Financial Impact
    await reverseFinancialImpact(original, business_id);

    // 3. Prepare Data
    const correction_version = ((original as any).correction_version || 0) + 1;
    const updateSpec: any = {
      ...updatedData,
      status: 'edited',
      is_edited: true,
      correction_version,
      correction_reason: reason,
      corrected_at: new Date(),
      updated_at: new Date(),
      original_payload: ((original as any).original_payload || original)
    };

    // 4. Update Database
    await db.transactions.update(original.id!, updateSpec);

    // 5. Apply Impact
    const finalTransaction = { ...original, ...updateSpec } as Transaction;
    await applyFinancialImpact(finalTransaction, business_id);

    // 6. Audit Log
    await db.audit_logs.add({
      ...createBaseEntity(business_id),
      user_id: userId,
      entity_type: 'transaction',
      entity_id: original.local_id,
      action: 'corrected',
      old_value: original,
      new_value: finalTransaction,
      reason: reason
    } as any);
  }
};