import { LedgerEntry, Transaction } from '@/db/schema';
import { percentageChange, roundCurrency, safeDivide } from './reportSelectors';

export interface ProfitLossReport {
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  profit_margin: number;
  grossMargin: number;
  trendDirection: 'up' | 'down' | 'flat';
  comparison: {
    previousNetProfit: number;
    netProfitChange: number;
  };
}

function ledgerBalance(entries: LedgerEntry[], account_name: string) {
  return roundCurrency(
    entries
      .reduce((total, entry: any) => {
  let balance = 0;
  
  if (entry.debit_account === account_name) balance += entry.amount;
  if (entry.credit_account === account_name) balance -= entry.amount;
  
  return total + balance;
}, 0)
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
      .filter((transaction) => transaction.type === 'expense' && transaction.source_type !== 'restock')
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
      profit_margin: roundCurrency(safeDivide(netProfit, totalRevenue) * 100),
      grossMargin: roundCurrency(safeDivide(grossProfit, totalRevenue) * 100),
      trendDirection: netProfitChange > 0 ? 'up' : netProfitChange < 0 ? 'down' : 'flat',
      comparison: {
        previousNetProfit,
        netProfitChange,
      },
    };
  },
};
