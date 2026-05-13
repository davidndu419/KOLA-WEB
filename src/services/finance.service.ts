// src/services/finance.service.ts
import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, Receivable } from '@/db/schema';
import { processAccounting } from '@/accounting/engine';

export const financeService = {
  async recordExpense(
    data: {
      amount: number;
      category: string;
      paymentMethod: 'cash' | 'transfer';
      note?: string;
    },
    businessId: string
  ) {
    const base = createBaseEntity(businessId);
    const transaction: Transaction = {
      ...base,
      type: 'expense',
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      category: data.category,
      status: 'completed',
      note: data.note,
    };

    await db.transaction('rw', [db.transactions, db.ledger_entries, db.sync_queue], async () => {
      await db.transactions.add(transaction);
      await processAccounting(transaction);
      await db.sync_queue.add({
        table: 'transactions',
        action: 'create',
        data: transaction,
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending'
      });
    });

    return transaction;
  },

  async recordService(
    data: {
      amount: number;
      paymentMethod: 'cash' | 'transfer' | 'credit';
      customerId?: string;
      customerName?: string;
      note?: string;
    },
    businessId: string
  ) {
    const base = createBaseEntity(businessId);
    const transaction: Transaction = {
      ...base,
      type: 'service',
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      status: 'completed',
      customerId: data.customerId,
      customer: data.customerName,
      note: data.note,
    };

    await db.transaction('rw', [db.transactions, db.ledger_entries, db.sync_queue, db.receivables, db.customers], async () => {
      await db.transactions.add(transaction);
      
      if (data.paymentMethod === 'credit' && data.customerId) {
        const receivableBase = createBaseEntity(businessId);
        await db.receivables.add({
          ...receivableBase,
          transactionId: transaction.localId,
          customerId: data.customerId,
          amount: data.amount,
          paidAmount: 0,
          status: 'pending'
        });
        
        const customer = await db.customers.where('localId').equals(data.customerId).first();
        if (customer) {
          await db.customers.update(customer.id!, {
            totalDebt: (customer.totalDebt || 0) + data.amount,
            updatedAt: new Date()
          });
        }
      }

      await processAccounting(transaction);
      await db.sync_queue.add({
        table: 'transactions',
        action: 'create',
        data: transaction,
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending'
      });
    });

    return transaction;
  },

  async confirmCreditPayment(receivableId: string, amount: number, paymentMethod: 'cash' | 'transfer') {
    const receivable = await db.receivables.where('localId').equals(receivableId).first();
    if (!receivable) throw new Error('Receivable not found');

    const businessId = receivable.businessId;
    const base = createBaseEntity(businessId);

    return await db.transaction('rw', [db.receivables, db.transactions, db.ledger_entries, db.customers, db.sync_queue], async () => {
      const newPaidAmount = receivable.paidAmount + amount;
      const status = newPaidAmount >= receivable.amount ? 'paid' : 'partially-paid';

      await db.receivables.update(receivable.id!, {
        paidAmount: newPaidAmount,
        status,
        updatedAt: new Date()
      });

      // Update customer debt
      const customer = await db.customers.where('localId').equals(receivable.customerId).first();
      if (customer) {
        await db.customers.update(customer.id!, {
          totalDebt: Math.max(0, customer.totalDebt - amount),
          updatedAt: new Date()
        });
      }

      // Create a virtual transaction for the payment to update ledger
      const paymentTx: Transaction = {
        ...base,
        type: 'service', // Or a new type 'credit-payment'
        amount: amount,
        paymentMethod: paymentMethod,
        status: 'completed',
        note: `Credit payment for transaction ${receivable.transactionId}`,
      };
      
      // Manually handle accounting for credit payment
      // Debit Cash/Bank, Credit Receivable
      const ledgerBase = createBaseEntity(businessId);
      await db.ledger_entries.bulkAdd([
        {
          ...ledgerBase,
          transactionId: paymentTx.localId,
          accountName: paymentMethod === 'cash' ? 'Cash' : 'Bank',
          debit: amount,
          credit: 0
        },
        {
          ...ledgerBase,
          transactionId: paymentTx.localId,
          accountName: 'Receivables',
          debit: 0,
          credit: amount
        }
      ] as any);

      await db.sync_queue.add({
        table: 'receivables',
        action: 'update',
        data: { localId: receivableId, paidAmount: newPaidAmount, status },
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending'
      });
    });
  }
};
