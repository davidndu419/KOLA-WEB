import { Customer, LedgerEntry, Receivable } from '@/db/schema';
import { compareDesc, roundCurrency, safeDivide } from './reportSelectors';

export interface CustomerBalance {
  customerId: string;
  name: string;
  outstanding: number;
  paidAmount: number;
  totalCredit: number;
}

export interface ReceivableAgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface ReceivableReport {
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  recentPayments: LedgerEntry[];
  customerBalances: CustomerBalance[];
  aging: ReceivableAgingBucket[];
  paymentCompletionRate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const receivableReportService = {
  analyze(
    receivables: Receivable[],
    customers: Customer[],
    ledgerEntries: LedgerEntry[],
    now = new Date()
  ): ReceivableReport {
    const activeReceivables = receivables.filter((receivable) => !receivable.deletedAt);
    const customerMap = new Map(customers.map((customer) => [customer.localId, customer]));
    const balanceMap = new Map<string, CustomerBalance>();
    const aging: ReceivableAgingBucket[] = [
      { label: '0-7d', amount: 0, count: 0 },
      { label: '8-30d', amount: 0, count: 0 },
      { label: '31-60d', amount: 0, count: 0 },
      { label: '60d+', amount: 0, count: 0 },
    ];

    let totalOutstanding = 0;
    let totalPaid = 0;
    let totalCredit = 0;
    let overdueAmount = 0;
    let overdueCount = 0;

    for (const receivable of activeReceivables) {
      const outstanding = Math.max(0, receivable.amount - receivable.paidAmount);
      const customer = customerMap.get(receivable.customerId);
      const existing = balanceMap.get(receivable.customerId) || {
        customerId: receivable.customerId,
        name: customer?.name || receivable.customerId || 'Walk-in customer',
        outstanding: 0,
        paidAmount: 0,
        totalCredit: 0,
      };

      existing.outstanding += outstanding;
      existing.paidAmount += receivable.paidAmount;
      existing.totalCredit += receivable.amount;
      balanceMap.set(receivable.customerId, existing);

      totalOutstanding += outstanding;
      totalPaid += receivable.paidAmount;
      totalCredit += receivable.amount;

      const dueDate = receivable.dueDate || new Date(receivable.createdAt.getTime() + 30 * DAY_MS);
      if (outstanding > 0 && dueDate < now) {
        overdueAmount += outstanding;
        overdueCount += 1;
      }

      if (outstanding > 0) {
        const ageDays = Math.max(0, Math.floor((now.getTime() - receivable.createdAt.getTime()) / DAY_MS));
        const bucket = ageDays <= 7 ? aging[0] : ageDays <= 30 ? aging[1] : ageDays <= 60 ? aging[2] : aging[3];
        bucket.amount += outstanding;
        bucket.count += 1;
      }
    }

    const recentPayments = ledgerEntries
      .filter((entry) => !entry.deletedAt && entry.accountName === 'Receivables' && entry.credit > 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);

    return {
      totalOutstanding: roundCurrency(totalOutstanding),
      overdueAmount: roundCurrency(overdueAmount),
      overdueCount,
      recentPayments,
      customerBalances: Array.from(balanceMap.values())
        .map((balance) => ({
          ...balance,
          outstanding: roundCurrency(balance.outstanding),
          paidAmount: roundCurrency(balance.paidAmount),
          totalCredit: roundCurrency(balance.totalCredit),
        }))
        .sort(compareDesc((balance) => balance.outstanding))
        .slice(0, 8),
      aging: aging.map((bucket) => ({ ...bucket, amount: roundCurrency(bucket.amount) })),
      paymentCompletionRate: roundCurrency(safeDivide(totalPaid, totalCredit) * 100),
    };
  },
};
