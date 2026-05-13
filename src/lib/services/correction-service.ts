import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement } from '@/db/schema';

/**
 * FIXED: Standalone function for Sale Validation
 */
async function validateSaleCorrection(original: Transaction, updated: Partial<Transaction>) {
  if (!updated.items) return;

  for (const item of updated.items) {
    const product = await db.products.where('localId').equals(item.productId).first();
    if (!product) continue;

    const originalItem = original.items?.find(i => i.productId === item.productId);
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
async function reverseFinancialImpact(transaction: Transaction, businessId: string) {
  // Ledgers
  const entries = await db.ledger_entries.where('transactionId').equals(transaction.localId).toArray();
  for (const entry of entries) {
    await db.ledger_entries.add({
      ...createBaseEntity(businessId),
      transactionId: transaction.localId,
      accountName: entry.accountName,
      debit: entry.credit,
      credit: entry.debit,
      isCorrection: true,
      reversalOfEntryId: entry.localId
    });
  }

  // Inventory (if sale)
  if (transaction.type === 'sale' && transaction.items) {
    for (const item of transaction.items) {
      const product = await db.products.where('localId').equals(item.productId).first();
      if (product) {
        const newStock = product.stock + item.quantity;
        await db.products.update(product.id!, { stock: newStock });
        await db.inventory_movements.add({
          ...createBaseEntity(businessId),
          productId: item.productId,
          type: 'return',
          quantity: item.quantity,
          previousStock: product.stock,
          newStock,
          reason: `Correction Reverse: ${transaction.localId}`
        });
      }
    }
  }

  // Receivables (if credit)
  if (transaction.paymentMethod === 'credit') {
    const rec = await db.receivables.where('transactionId').equals(transaction.localId).first();
    if (rec) {
      await db.receivables.update(rec.id!, { status: 'voided' });
    }
  }
}

/**
 * FIXED: Standalone function for Applying New Impact
 */
async function applyFinancialImpact(transaction: Transaction, businessId: string) {
  if (transaction.type === 'sale' && transaction.items) {
    for (const item of transaction.items) {
      const product = await db.products.where('localId').equals(item.productId).first();
      if (product) {
        const newStock = product.stock - item.quantity;
        await db.products.update(product.id!, { stock: newStock });
        await db.inventory_movements.add({
          ...createBaseEntity(businessId),
          productId: item.productId,
          type: 'stock-out',
          quantity: item.quantity,
          previousStock: product.stock,
          newStock,
          reason: `Correction Apply: ${transaction.localId}`
        });
      }
    }

    // Ledger Entries
    const accountName = transaction.paymentMethod === 'cash' ? 'Cash' : 
                        transaction.paymentMethod === 'transfer' ? 'Bank' : 'Receivables';
    
    await db.ledger_entries.add({
      ...createBaseEntity(businessId),
      transactionId: transaction.localId,
      accountName,
      debit: transaction.amount,
      credit: 0,
      isCorrection: true
    });

    await db.ledger_entries.add({
      ...createBaseEntity(businessId),
      transactionId: transaction.localId,
      accountName: 'Sales Revenue',
      debit: 0,
      credit: transaction.amount,
      isCorrection: true
    });

    // COGS
    let totalCOGS = 0;
    for (const item of transaction.items) {
      const product = await db.products.where('localId').equals(item.productId).first();
      if (product) totalCOGS += (product.buyingPrice * item.quantity);
    }

    await db.ledger_entries.add({
      ...createBaseEntity(businessId),
      transactionId: transaction.localId,
      accountName: 'COGS',
      debit: totalCOGS,
      credit: 0,
      isCorrection: true
    });

    await db.ledger_entries.add({
      ...createBaseEntity(businessId),
      transactionId: transaction.localId,
      accountName: 'Inventory',
      debit: 0,
      credit: totalCOGS,
      isCorrection: true
    });

    if (transaction.paymentMethod === 'credit') {
      await db.receivables.add({
        ...createBaseEntity(businessId),
        transactionId: transaction.localId,
        customerId: transaction.customerId || '',
        amount: transaction.amount,
        paidAmount: 0,
        status: 'pending'
      });
    }
  }
}

/**
 * MAIN EXPORTED SERVICE
 */
export const CorrectionService = {
  async correctTransaction(transactionId: string, updatedData: Partial<Transaction>, reason: string, businessId: string, userId: string) {
    const original = await db.transactions.where('localId').equals(transactionId).first();
    if (!original) throw new Error('Transaction not found');
    if (original.status === 'reversed') throw new Error('Cannot correct a reversed transaction');

    // 1. Validate
    if (original.type === 'sale') {
      await validateSaleCorrection(original, updatedData);
    }

    // 2. Reverse Financial Impact
    await reverseFinancialImpact(original, businessId);

    // 3. Prepare Data
    const correctionVersion = (original.correctionVersion || 0) + 1;
    const updateSpec: any = {
      ...updatedData,
      status: 'edited',
      isEdited: true,
      correctionVersion,
      correctionReason: reason,
      correctedAt: new Date(),
      updatedAt: new Date(),
      originalPayload: (original.originalPayload || original)
    };

    // 4. Update Database
    await db.transactions.update(original.id!, updateSpec);

    // 5. Apply Impact
    const finalTransaction = { ...original, ...updateSpec } as Transaction;
    await applyFinancialImpact(finalTransaction, businessId);

    // 6. Audit Log (FIXED: added userId)
    await db.audit_logs.add({
      ...createBaseEntity(businessId),
      userId: userId, 
      entityType: 'transaction',
      entityId: original.localId,
      action: 'corrected',
      oldValue: original,
      newValue: finalTransaction,
      reason: reason
    });
  }
};