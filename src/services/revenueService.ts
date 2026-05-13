import { Transaction } from '@/db/schema';
import { ChartPoint, transactionsToRevenueSeries } from './chartTransformers';
import { percentageChange, ResolvedReportRange, roundCurrency, safeDivide } from './reportSelectors';

export interface RevenueAnalytics {
  totalRevenue: number;
  salesRevenue: number;
  serviceRevenue: number;
  salesCount: number;
  serviceCount: number;
  transactionCount: number;
  averageTransactionValue: number;
  growthRate: number;
  trendDirection: 'up' | 'down' | 'flat';
  series: ChartPoint[];
  comparison: {
    current: number;
    previous: number;
    change: number;
  };
}

function incomeTransactions(transactions: Transaction[]) {
  return transactions.filter((transaction) => transaction.type === 'sale' || transaction.type === 'service');
}

export const revenueService = {
  analyze(
    transactions: Transaction[],
    previousTransactions: Transaction[],
    range: ResolvedReportRange
  ): RevenueAnalytics {
    const sales = transactions.filter((transaction) => transaction.type === 'sale');
    const services = transactions.filter((transaction) => transaction.type === 'service');
    const currentIncome = incomeTransactions(transactions);
    const previousIncome = incomeTransactions(previousTransactions);

    const salesRevenue = roundCurrency(sales.reduce((total, transaction) => total + transaction.amount, 0));
    const serviceRevenue = roundCurrency(services.reduce((total, transaction) => total + transaction.amount, 0));
    const totalRevenue = roundCurrency(salesRevenue + serviceRevenue);
    const previousRevenue = roundCurrency(previousIncome.reduce((total, transaction) => total + transaction.amount, 0));
    const growthRate = percentageChange(totalRevenue, previousRevenue);

    return {
      totalRevenue,
      salesRevenue,
      serviceRevenue,
      salesCount: sales.length,
      serviceCount: services.length,
      transactionCount: currentIncome.length,
      averageTransactionValue: roundCurrency(safeDivide(totalRevenue, currentIncome.length)),
      growthRate,
      trendDirection: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'flat',
      series: transactionsToRevenueSeries(transactions, range),
      comparison: {
        current: totalRevenue,
        previous: previousRevenue,
        change: growthRate,
      },
    };
  },
};
