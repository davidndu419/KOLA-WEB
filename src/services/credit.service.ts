import { db, createBaseEntity } from '@/db/dexie';
import type { AuditLog, LedgerEntry, Receivable, Transaction } from '@/db/schema';

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
  dueDate: Date;
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
  paymentMethod: 'cash' | 'transfer';
  paymentDate?: Date;
  note?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function defaultDueDate(receivable: Receivable) {
  return receivable.dueDate || new Date(receivable.createdAt.getTime() + 30 * DAY_MS);
}

function isOverdue(receivable: Receivable, now = new Date()) {
  return receivable.status !== 'paid' && defaultDueDate(receivable).getTime() < now.getTime();
}

function balance(receivable: Receivable) {
  return Math.max(0, receivable.amount - receivable.paidAmount);
}

async function creditHistory(sourceType: CreditSourceType): Promise<CreditHistoryItem[]> {
  const [receivables, transactions, customers] = await Promise.all([
    db.receivables.toArray(),
    db.transactions.toArray(),
    db.customers.toArray(),
  ]);
  const transactionMap = new Map(transactions.map((transaction) => [transaction.localId, transaction]));
  const customerMap = new Map(customers.map((customer) => [customer.localId, customer]));

  return receivables
    .map((receivable) => {
      const transaction = transactionMap.get(receivable.transactionId);
      if (!transaction || transaction.type !== sourceType || transaction.deletedAt || receivable.deletedAt) return null;
      const customer = customerMap.get(receivable.customerId);

      return {
        receivable,
        transaction,
        customerName: transaction.customer || customer?.name || transaction.customerId || 'Walk-in customer',
        sourceName: sourceType === 'service'
          ? transaction.note || 'Service'
          : transaction.items?.length
            ? `${transaction.items.length} item sale`
            : 'Product sale',
        amountOwed: receivable.amount,
        amountPaid: receivable.paidAmount,
        balance: balance(receivable),
        dueDate: defaultDueDate(receivable),
        isOverdue: isOverdue(receivable),
      };
    })
    .filter((item): item is CreditHistoryItem => Boolean(item))
    .sort((a, b) => b.receivable.createdAt.getTime() - a.receivable.createdAt.getTime());
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

export function getSalesCreditHistory() {
  return creditHistory('sale');
}

export function getServiceCreditHistory() {
  return creditHistory('service');
}

export async function getSalesCreditSummary() {
  return summarize(await creditHistory('sale'));
}

export async function getServiceCreditSummary() {
  return summarize(await creditHistory('service'));
}

export async function getPendingSalesCreditCount() {
  return (await getSalesCreditSummary()).pendingCount;
}

export async function getPendingServiceCreditCount() {
  return (await getServiceCreditSummary()).pendingCount;
}

export async function getOverdueSalesCreditCount() {
  return (await getSalesCreditSummary()).overdueCount;
}

export async function getOverdueServiceCreditCount() {
  return (await getServiceCreditSummary()).overdueCount;
}

export function openSalesCreditHistory() {
  return undefined;
}

export function openServiceCreditHistory() {
  return undefined;
}

export async function confirmCreditPayment(input: CreditPaymentInput) {
  const receivable = await db.receivables.where('localId').equals(input.receivableId).first();
  if (!receivable) throw new Error('Receivable not found');

  const outstanding = balance(receivable);
  const amount = Math.min(input.amount, outstanding);
  if (amount <= 0) throw new Error('Payment amount must be greater than zero');

  const paymentDate = input.paymentDate || new Date();
  const ledgerBase = createBaseEntity(receivable.businessId);
  const auditBase = createBaseEntity(receivable.businessId);
  const paymentId = crypto.randomUUID();
  const newPaidAmount = Math.min(receivable.amount, receivable.paidAmount + amount);
  const status: Receivable['status'] = newPaidAmount >= receivable.amount ? 'paid' : 'partially-paid';

  return db.transaction('rw', [db.receivables, db.ledger_entries, db.customers, db.audit_logs, db.sync_queue], async () => {
    await db.receivables.update(receivable.id!, {
      paidAmount: newPaidAmount,
      status,
      updatedAt: paymentDate,
      syncStatus: 'pending',
    });

    const customer = await db.customers.where('localId').equals(receivable.customerId).first();
    if (customer) {
      await db.customers.update(customer.id!, {
        totalDebt: Math.max(0, customer.totalDebt - amount),
        updatedAt: paymentDate,
        syncStatus: 'pending',
      });
    }

    const ledgerEntries: Omit<LedgerEntry, 'id'>[] = [
      {
        ...ledgerBase,
        localId: crypto.randomUUID(),
        transactionId: paymentId,
        accountName: input.paymentMethod === 'cash' ? 'Cash' : 'Bank',
        debit: amount,
        credit: 0,
        createdAt: paymentDate,
        updatedAt: paymentDate,
      },
      {
        ...ledgerBase,
        localId: crypto.randomUUID(),
        transactionId: paymentId,
        accountName: 'Receivables',
        debit: 0,
        credit: amount,
        createdAt: paymentDate,
        updatedAt: paymentDate,
      },
    ];

    await db.ledger_entries.bulkAdd(ledgerEntries);

    const auditLog: Omit<AuditLog, 'id'> = {
      ...auditBase,
      userId: 'local-user',
      action: 'credit_payment',
      entityType: 'receivable',
      entityId: receivable.localId,
      previousValue: {
        paidAmount: receivable.paidAmount,
        status: receivable.status,
      },
      newValue: {
        paymentId,
        amount,
        paidAmount: newPaidAmount,
        status,
        paymentMethod: input.paymentMethod,
        paymentDate,
        note: input.note,
      },
      createdAt: paymentDate,
      updatedAt: paymentDate,
    };
    await db.audit_logs.add(auditLog);

    await db.sync_queue.bulkAdd([
      {
        table: 'receivables',
        action: 'update',
        data: { localId: receivable.localId, paidAmount: newPaidAmount, status },
        timestamp: paymentDate,
        retryCount: 0,
        status: 'pending',
      },
      {
        table: 'ledger_entries',
        action: 'create',
        data: ledgerEntries,
        timestamp: paymentDate,
        retryCount: 0,
        status: 'pending',
      },
      {
        table: 'audit_logs',
        action: 'create',
        data: auditLog,
        timestamp: paymentDate,
        retryCount: 0,
        status: 'pending',
      },
    ]);

    return { paidAmount: newPaidAmount, status };
  });
}

export const creditService = {
  getSalesCreditHistory,
  getServiceCreditHistory,
  getSalesCreditSummary,
  getServiceCreditSummary,
  getPendingSalesCreditCount,
  getPendingServiceCreditCount,
  getOverdueSalesCreditCount,
  getOverdueServiceCreditCount,
  openSalesCreditHistory,
  openServiceCreditHistory,
  confirmCreditPayment,
  recordPartialCreditPayment: confirmCreditPayment,
};

export const recordPartialCreditPayment = confirmCreditPayment;
