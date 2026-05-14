// src/lib/services/reversal-service.ts
import { db } from '@/db/dexie';
import { Transaction, LedgerEntry, InventoryMovement, AuditLog, TransactionWithItems } from '@/db/schema';

import { createBaseEntity } from '@/db/dexie';

export class ReversalService {
  /**
   * Main entry point for reversing any transaction
   */
  static async reverseTransaction(transaction_id: string, reason: string, business_id: string) {
    const transaction = await db.transactions.where('local_id').equals(transaction_id).first() as TransactionWithItems | undefined;

    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status === 'reversed') throw new Error('Transaction already reversed');

    // 1. Mark original transaction as reversed
    await db.transactions.update(transaction.id!, {
      status: 'reversed',
      is_reversed: true,
      reversal_reason: reason,
      reversed_at: new Date(),
      updated_at: new Date()
    } as any);


    // 2. Logic per transaction type
    switch (transaction.type) {
      case 'sale':
        await this.reverseSale(transaction, business_id);
        break;
      case 'service':
        await this.reverseService(transaction, business_id);
        break;
      case 'expense':
        await this.reverseExpense(transaction, business_id);
        break;
      case 'credit_payment':
        await this.reverseCreditPayment(transaction, business_id);
        break;
    }

    // 3. Create Audit Log
    await this.createAuditLog(transaction, 'reversed', reason, business_id);

    // 4. Create Reversal Transaction (for reporting clarity)
    await this.createReversalTransaction(transaction, reason, business_id);
  }

  private static async reverseSale(sale: TransactionWithItems, business_id: string) {

    // A. Restore Stock
    if (sale.items) {
      for (const item of sale.items) {
        const product = await db.products.where('local_id').equals(item.product_id).first();
        if (product) {
          const new_stock = product.stock + item.quantity;
          await db.products.update(product.id!, { 
            stock: new_stock,
            updated_at: new Date()
          });

          // Record movement
          await db.inventory_movements.add({
            ...createBaseEntity(business_id),
            product_id: item.product_id,
            type: 'return',
            quantity: item.quantity,
            previous_stock: product.stock,
            new_stock: new_stock,
            reason: `Sale Reversal: ${sale.local_id}`,
            status: 'active'
          });
        }
      }
    }

    // B. Reverse Ledger Entries
    // Find original entries
    const entries = await db.ledger_entries.where('transaction_id').equals(sale.local_id).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(business_id),
        transaction_id: sale.local_id,
        account_name: entry.account_name,
        // Reverse debit/credit
        debit: entry.credit,
        credit: entry.debit,
        is_reversal: true,
        reversal_of_entry_id: entry.local_id
      } as any);

    }

    // C. Handle Receivables if credit sale
    if (sale.payment_method === 'credit') {
      const receivable = await db.receivables.where('transaction_id').equals(sale.local_id).first();
      if (receivable) {
        await db.receivables.update(receivable.id!, {
          status: 'voided',
          updated_at: new Date()
        });
      }
    }
  }

  private static async reverseService(service: Transaction, business_id: string) {
    // Reverse Ledger Entries (Revenue and Cash/Bank/Receivable)
    const entries = await db.ledger_entries.where('transaction_id').equals(service.local_id).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(business_id),
        transaction_id: service.local_id,
        account_name: entry.account_name,
        debit: entry.credit,
        credit: entry.debit,
        is_reversal: true,
        reversal_of_entry_id: entry.local_id
      } as any);

    }

    // Handle Receivables if credit service
    if (service.payment_method === 'credit') {
      const receivable = await db.receivables.where('transaction_id').equals(service.local_id).first();
      if (receivable) {
        await db.receivables.update(receivable.id!, {
          status: 'voided',
          updated_at: new Date()
        });
      }
    }
  }

  private static async reverseExpense(expense: Transaction, business_id: string) {
    // Reverse Ledger Entries (Expense and Cash/Bank)
    const entries = await db.ledger_entries.where('transaction_id').equals(expense.local_id).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(business_id),
        transaction_id: expense.local_id,
        account_name: entry.account_name,
        debit: entry.credit,
        credit: entry.debit,
        is_reversal: true,
        reversal_of_entry_id: entry.local_id
      } as any);

    }
  }

  private static async reverseCreditPayment(payment: Transaction, business_id: string) {
    // 1. Find the receivable being paid
    // Credit payments usually link back to a receivable via sourceId or something similar
    // Assuming credit payments store the receivableId in sourceId
    const receivableId = payment.sourceId;
    if (!receivableId) return;

    const receivable = await db.receivables.where('local_id').equals(receivableId).first();
    if (!receivable) return;

    // 2. Reverse Ledger Entries
    const entries = await db.ledger_entries.where('transaction_id').equals(payment.local_id).toArray();
    for (const entry of entries) {
      await db.ledger_entries.add({
        ...createBaseEntity(business_id),
        transaction_id: payment.local_id,
        account_name: entry.account_name,
        debit: entry.credit,
        credit: entry.debit,
        is_reversal: true,
        reversal_of_entry_id: entry.local_id
      } as any);

    }

    // 3. Update Receivable balance
    const newPaidAmount = Math.max(0, (receivable.paid_amount || 0) - payment.amount);
    let newStatus = receivable.status;

    if (newPaidAmount === 0) newStatus = 'pending';
    else if (newPaidAmount < receivable.amount) newStatus = 'partially-paid';

    await db.receivables.update(receivable.id!, {
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_at: new Date()
    });
  }

  private static async createReversalTransaction(original: Transaction, reason: string, business_id: string) {
    await db.transactions.add({
      ...createBaseEntity(business_id),
      type: 'reversal',
      amount: original.amount,
      payment_method: original.payment_method,
      status: 'active',
      original_transaction_id: original.local_id,
      source_type: original.type as any,
      source_id: original.local_id,
      reversal_reason: reason,
      note: `Reversal of ${original.type}: ${original.local_id}`
    } as any);

  }

  private static async createAuditLog(entity: Transaction, action: string, reason: string, business_id: string) {
    await db.audit_logs.add({
      ...createBaseEntity(business_id),
      user_id: 'offline_user',
      entity_type: 'transaction',
      entity_id: entity.local_id,
      action: action as any,
      old_value: entity,
      reason: reason
    } as any);

  }
}
