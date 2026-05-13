import { LedgerEntry, Transaction } from '@/db/schema';
import { percentageChange, roundCurrency, safeDivide } from './reportSelectors';

export interface ProfitLossReport {
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  profitMargin: number;
  grossMargin: number;
  trendDirection: 'up' | 'down' | 'flat';
  comparison: {
    previousNetProfit: number;
    netProfitChange: number;
  };
}

function ledgerBalance(entries: LedgerEntry[], accountName: string) {
  return roundCurrency(
    entries
      .filter((entry) => !entry.deletedAt && entry.accountName === accountName)
      .reduce((total, entry) => total + entry.debit - entry.credit, 0)
  );
}

function revenueFromTransactions(transactions: Transaction[]) {
  return roundCurrency(
    transactions
      .filter((transaction) => transaction.type === 'sale' || transaction.type === 'service')
      .reduce((total, transaction) => total + transaction.amount, 0)
  );
}

function expensesFromTransactions(transactions: Transaction[]) {
  return roundCurrency(
    transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0)
  );
}

export const profitLossService = {
  calculate(
    transactions: Transaction[],
    ledgerEntries: LedgerEntry[],
    previousTransactions: Transaction[],
    previousLedgerEntries: LedgerEntry[]
  ): ProfitLossReport {
    const totalRevenue = revenueFromTransactions(transactions);
    const costOfGoodsSold = ledgerBalance(ledgerEntries, 'COGS');
    const operatingExpenses = expensesFromTransactions(transactions);
    const grossProfit = roundCurrency(totalRevenue - costOfGoodsSold);
    const netProfit = roundCurrency(grossProfit - operatingExpenses);
    const previousRevenue = revenueFromTransactions(previousTransactions);
    const previousCogs = ledgerBalance(previousLedgerEntries, 'COGS');
    const previousExpenses = expensesFromTransactions(previousTransactions);
    const previousNetProfit = roundCurrency(previousRevenue - previousCogs - previousExpenses);
    const netProfitChange = percentageChange(netProfit, previousNetProfit);

    return {
      totalRevenue,
      costOfGoodsSold,
      grossProfit,
      operatingExpenses,
      netProfit,
      profitMargin: roundCurrency(safeDivide(netProfit, totalRevenue) * 100),
      grossMargin: roundCurrency(safeDivide(grossProfit, totalRevenue) * 100),
      trendDirection: netProfitChange > 0 ? 'up' : netProfitChange < 0 ? 'down' : 'flat',
      comparison: {
        previousNetProfit,
        netProfitChange,
      },
    };
  },
};
