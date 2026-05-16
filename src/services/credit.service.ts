import { db, createBaseEntity } from '@/db/dexie';
import type { AuditLog, LedgerEntry, Receivable, Transaction } from '@/db/schema';
import { syncQueueService } from './syncQueueService';
import { assertBalanced, assertCashSolvencyForEntries } from '@/accounting/guards';

export type CreditSourceType = 'sale' | 'service';
export type CreditFilter = 'all' | 'pending' | 'partially-paid' | 'paid' | 'overdue';

export interface CreditHistoryItem {
  receivable: Receivable;
  transaction: Transaction;
  customerName: string;
  sourceName: string;
  amountOwed: number;
  amountPaid: number;
  balance: number;
  due_date: Date;
  isOverdue: boolean;
}

export interface CreditSummary {
  totalPending: number;
  pendingCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overdueCount: number;
}

export interface CreditPaymentInput {
  receivableId: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  paymentDate?: Date;
  note?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function defaultDueDate(receivable: Receivable) {
  return receivable.due_date || new Date(receivable.created_at.getTime() + 30 * DAY_MS);
}

function isOverdue(receivable: Receivable, now = new Date()) {
  return receivable.status !== 'paid' && defaultDueDate(receivable).getTime() < now.getTime();
}

function getBalance(receivable: Receivable) {
  return Math.max(0, receivable.amount - receivable.paid_amount);
}

async function creditHistory(sourceType: CreditSourceType): Promise<CreditHistoryItem[]> {
  const [receivables, transactions, customers] = await Promise.all([
    db.receivables.toArray(),
    db.transactions.toArray(),
    db.customers.toArray(),
  ]);
  const transactionMap = new Map(transactions.map((transaction) => [transaction.local_id, transaction]));
  const customerMap = new Map(customers.map((customer) => [customer.local_id, customer]));

  return receivables
    .map((receivable) => {
      const transaction = transactionMap.get(receivable.transaction_id);
      if (!transaction || transaction.type !== sourceType || transaction.deleted_at || receivable.deleted_at) return null;
      const customer = customerMap.get(receivable.customer_id);

      return {
        receivable,
        transaction,
        customerName: customer?.name || 'Walk-in customer',
        sourceName: sourceType === 'service'
          ? transaction.note || 'Service'
          : 'Product sale',
        amountOwed: receivable.amount,
        amountPaid: receivable.paid_amount,
        balance: getBalance(receivable),
        due_date: defaultDueDate(receivable),
        isOverdue: isOverdue(receivable),
      };
    })
    .filter((item): item is CreditHistoryItem => Boolean(item))
    .sort((a, b) => b.receivable.created_at.getTime() - a.receivable.created_at.getTime());
}

function summarize(items: CreditHistoryItem[]): CreditSummary {
  return {
    totalPending: items.reduce((total, item) => total + item.balance, 0),
    pendingCount: items.filter((item) => item.receivable.status === 'pending' || item.receivable.status === 'partially-paid').length,
    partiallyPaidCount: items.filter((item) => item.receivable.status === 'partially-paid').length,
    paidCount: items.filter((item) => item.receivable.status === 'paid').length,
    overdueCount: items.filter((item) => item.isOverdue).length,
  };
}

export const creditService = {
  getSalesCreditHistory: () => creditHistory('sale'),
  getServiceCreditHistory: () => creditHistory('service'),
  getSalesCreditSummary: async () => summarize(await creditHistory('sale')),
  getServiceCreditSummary: async () => summarize(await creditHistory('service')),
  
  async confirmCreditPayment(input: CreditPaymentInput) {
    const receivable = await db.receivables.where('local_id').equals(input.receivableId).first();
    if (!receivable) throw new Error('Receivable not found');

    const outstanding = getBalance(receivable);
    const amount = Math.min(input.amount, outstanding);
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');

    const business_id = receivable.business_id;
    const paymentDate = input.paymentDate || new Date();
    
    return db.transaction('rw', [db.receivables, db.transactions, db.ledger_entries, db.customers, db.audit_logs, db.sync_queue], async () => {
      const newPaidAmount = receivable.paid_amount + amount;
      const status: Receivable['status'] = newPaidAmount >= receivable.amount ? 'paid' : 'partially-paid';

      // 1. Update Receivable
      const updatedReceivable = {
        ...receivable,
        paid_amount: newPaidAmount,
        status,
        updated_at: paymentDate,
        sync_status: 'pending' as const
      };
      await db.receivables.update(receivable.id!, updatedReceivable);
      await syncQueueService.enqueue('receivables', 'update', updatedReceivable, business_id);

      // 2. Update Customer
      const customer = await db.customers.where('local_id').equals(receivable.customer_id).first();
      if (customer) {
        const updatedCustomer = {
          ...customer,
          total_debt: Math.max(0, (customer.total_debt || 0) - amount),
          updated_at: paymentDate,
          sync_status: 'pending' as const
        };
        await db.customers.update(customer.id!, updatedCustomer);
        await syncQueueService.enqueue('customers', 'update', updatedCustomer, business_id);
      }

      // 3. Create Payment Transaction
      const paymentTx: Transaction = {
        ...createBaseEntity(business_id),
        type: 'credit_payment',
        amount,
        payment_method: input.payment_method,
        status: 'completed',
        reference_id: receivable.local_id,
        note: input.note || `Credit payment for transaction ${receivable.transaction_id}`,
      };
      await db.transactions.add(paymentTx);
      await syncQueueService.enqueue('transactions', 'create', paymentTx, business_id);

      // 4. Ledger Entries
      const ledgerBase = createBaseEntity(business_id);
      const entry: any = {
    ...ledgerBase,
    transaction_id: paymentTx.local_id,
    source_type: 'credit_payment',
    source_id: receivable.local_id,
    debit_account: input.payment_method === 'cash' ? 'Cash' : 'Bank',
    credit_account: 'Receivables',
    amount,
    is_reversal: false,
    is_correction: false,
};
      assertBalanced([entry]);
      await assertCashSolvencyForEntries([entry], business_id);
      await db.ledger_entries.add(entry);
      await syncQueueService.enqueue('ledger_entries', 'create', entry, business_id);


      return { paid_amount: newPaidAmount, status };
    });
  },
  
  recordPartialCreditPayment(input: CreditPaymentInput) {
    return this.confirmCreditPayment(input);
  }
};
