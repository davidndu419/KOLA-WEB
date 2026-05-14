import { Customer, LedgerEntry, Receivable } from '@/db/schema';
import { compareDesc, roundCurrency, safeDivide } from './reportSelectors';

export interface CustomerBalance {
  customer_id: string;
  name: string;
  outstanding: number;
  paid_amount: number;
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
    const activeReceivables = receivables.filter((receivable) => !receivable.deleted_at);
    const customerMap = new Map(customers.map((customer) => [customer.local_id, customer]));
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
      const outstanding = Math.max(0, receivable.amount - receivable.paid_amount);
      const customer = customerMap.get(receivable.customer_id);
      const existing = balanceMap.get(receivable.customer_id) || {
        customer_id: receivable.customer_id,
        name: customer?.name || receivable.customer_id || 'Walk-in customer',
        outstanding: 0,
        paid_amount: 0,
        totalCredit: 0,
      };

      existing.outstanding += outstanding;
      existing.paid_amount += receivable.paid_amount;
      existing.totalCredit += receivable.amount;
      balanceMap.set(receivable.customer_id, existing);

      totalOutstanding += outstanding;
      totalPaid += receivable.paid_amount;
      totalCredit += receivable.amount;

      const due_date = receivable.due_date || new Date(receivable.created_at.getTime() + 30 * DAY_MS);
      if (outstanding > 0 && due_date < now) {
        overdueAmount += outstanding;
        overdueCount += 1;
      }

      if (outstanding > 0) {
        const ageDays = Math.max(0, Math.floor((now.getTime() - receivable.created_at.getTime()) / DAY_MS));
        const bucket = ageDays <= 7 ? aging[0] : ageDays <= 30 ? aging[1] : ageDays <= 60 ? aging[2] : aging[3];
        bucket.amount += outstanding;
        bucket.count += 1;
      }
    }

    const recentPayments = ledgerEntries
      .filter((entry) => !entry.deleted_at && entry.credit_account === 'Receivables' && entry.amount > 0)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
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
          paid_amount: roundCurrency(balance.paid_amount),
          totalCredit: roundCurrency(balance.totalCredit),
        }))
        .sort(compareDesc((balance) => balance.outstanding))
        .slice(0, 8),
      aging: aging.map((bucket) => ({ ...bucket, amount: roundCurrency(bucket.amount) })),
      paymentCompletionRate: roundCurrency(safeDivide(totalPaid, totalCredit) * 100),
    };
  },
};
