// src/lib/services/reversal-service.ts
import { db } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement, AuditLog } from '@/db/schema';
import { createBaseEntity } from '@/db/dexie';

export class ReversalService {
  /**
   * Main entry point for reversing any transaction
   */
  static async reverseTransaction(transactionId: string, reason: string, businessId: string) {
    const transaction = await db.transactions.where('localId').equals(transactionId).first();
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'reversed') throw new Error('Transaction already reversed');

    // 1. Mark original transaction as reversed
    await db.transactions.update(transaction.id!, {
      status: 'reversed',
      isReversed: true,
      reversalReason: reason,
      reversedAt: new Date(),
      updatedAt: new Date()
    });

    // 2. Logic per transaction type
    switch (transaction.type) {
      case 'sale':
        await this.reverseSale(transaction, businessId);
        break;
      case 'service':
        await this.reverseService(transaction, businessId);
        break;
      case 'expense':
        await this.reverseExpense(transaction, businessId);
        break;
      case 'credit_payment':
        await this.reverseCreditPayment(transaction, businessId);
        break;
    }

    // 3. Create Audit Log
    await this.createAuditLog(transaction, 'reversed', reason, businessId);

    // 4. Create Reversal Transaction (for reporting clarity)
    await this.createReversalTransaction(transaction, reason, businessId);
  }

  private static async reverseSale(sale: Transaction, businessId: string) {
    // A. Restore Stock
    if (sale.items) {
      for (const item of sale.items) {
        const product = await db.products.where('localId').equals(item.productId).first();
        if (product) {
          const newStock = product.stock + item.quantity;
          await db.products.update(product.id!, { 
            stock: newStock,
            updatedAt: new Date()
          });

          // Record movement
          await db.inventory_movements.add({
            ...createBaseEntity(businessId),
            productId: item.productId,
            type: 'return',
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: newStock,
            reason: `Sale Reversal: ${sale.localId}`,
            status: 'active'
          });
        }
      }
    }

    // B. Reverse Ledger Entries
    // Find original entries
    const entries = await db.ledger_entries.where('transactionId').equals(sale.localId).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(businessId),
        transactionId: sale.localId,
        accountName: entry.accountName,
        // Reverse debit/credit
        debit: entry.credit,
        credit: entry.debit,
        isReversal: true,
        reversalOfEntryId: entry.localId
      });
    }

    // C. Handle Receivables if credit sale
    if (sale.paymentMethod === 'credit') {
      const receivable = await db.receivables.where('transactionId').equals(sale.localId).first();
      if (receivable) {
        await db.receivables.update(receivable.id!, {
          status: 'voided',
          updatedAt: new Date()
        });
      }
    }
  }

  private static async reverseService(service: Transaction, businessId: string) {
    // Reverse Ledger Entries (Revenue and Cash/Bank/Receivable)
    const entries = await db.ledger_entries.where('transactionId').equals(service.localId).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(businessId),
        transactionId: service.localId,
        accountName: entry.accountName,
        debit: entry.credit,
        credit: entry.debit,
        isReversal: true,
        reversalOfEntryId: entry.localId
      });
    }

    // Handle Receivables if credit service
    if (service.paymentMethod === 'credit') {
      const receivable = await db.receivables.where('transactionId').equals(service.localId).first();
      if (receivable) {
        await db.receivables.update(receivable.id!, {
          status: 'voided',
          updatedAt: new Date()
        });
      }
    }
  }

  private static async reverseExpense(expense: Transaction, businessId: string) {
    // Reverse Ledger Entries (Expense and Cash/Bank)
    const entries = await db.ledger_entries.where('transactionId').equals(expense.localId).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(businessId),
        transactionId: expense.localId,
        accountName: entry.accountName,
        debit: entry.credit,
        credit: entry.debit,
        isReversal: true,
        reversalOfEntryId: entry.localId
      });
    }
  }

  private static async reverseCreditPayment(payment: Transaction, businessId: string) {
    // 1. Find the receivable being paid
    // Credit payments usually link back to a receivable via sourceId or something similar
    // Assuming credit payments store the receivableId in sourceId
    const receivableId = payment.sourceId;
    if (!receivableId) return;

    const receivable = await db.receivables.where('localId').equals(receivableId).first();
    if (!receivable) return;

    // 2. Reverse Ledger Entries
    const entries = await db.ledger_entries.where('transactionId').equals(payment.localId).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(businessId),
        transactionId: payment.localId,
        accountName: entry.accountName,
        debit: entry.credit,
        credit: entry.debit,
        isReversal: true,
        reversalOfEntryId: entry.localId
      });
    }

    // 3. Update Receivable balance
    const newPaidAmount = Math.max(0, (receivable.paidAmount || 0) - payment.amount);
    let newStatus = receivable.status;

    if (newPaidAmount === 0) newStatus = 'pending';
    else if (newPaidAmount < receivable.amount) newStatus = 'partially-paid';

    await db.receivables.update(receivable.id!, {
      paidAmount: newPaidAmount,
      status: newStatus,
      updatedAt: new Date()
    });
  }

  private static async createReversalTransaction(original: Transaction, reason: string, businessId: string) {
    await db.transactions.add({
      ...createBaseEntity(businessId),
      type: 'reversal',
      amount: original.amount,
      paymentMethod: original.paymentMethod,
      status: 'active',
      originalTransactionId: original.localId,
      sourceType: original.type as any,
      sourceId: original.localId,
      reversalReason: reason,
      note: `Reversal of ${original.type}: ${original.localId}`
    });
  }

  private static async createAuditLog(entity: Transaction, action: string, reason: string, businessId: string) {
    await db.audit_logs.add({
      ...createBaseEntity(businessId),
      userId: 'offline_user'
      entityType: 'transaction',
      entityId: entity.localId,
      action: action as any,
      oldValue: entity,
      reason: reason
    });
  }
}
