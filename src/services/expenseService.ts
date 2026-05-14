import { Transaction } from '@/db/schema';
import { ChartPoint, transactionsToRevenueSeries } from './chartTransformers';
import { compareDesc, percentageChange, ResolvedReportRange, roundCurrency, safeDivide } from './reportSelectors';

export interface ExpenseCategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ExpenseAnalytics {
  totalExpenses: number;
  expenseCount: number;
  averageExpense: number;
  growthRate: number;
  highestCategories: ExpenseCategoryBreakdown[];
  recurringExpenses: ExpenseCategoryBreakdown[];
  series: ChartPoint[];
}

export const expenseService = {
  analyze(
    transactions: Transaction[],
    previousTransactions: Transaction[],
    range: ResolvedReportRange
  ): ExpenseAnalytics {
    const expenses = transactions.filter((transaction) => transaction.type === 'expense');
    const previousExpenses = previousTransactions.filter((transaction) => transaction.type === 'expense');
    const totalExpenses = roundCurrency(expenses.reduce((total, transaction) => total + transaction.amount, 0));
    const previousTotal = roundCurrency(previousExpenses.reduce((total, transaction) => total + transaction.amount, 0));
    const categoryMap = new Map<string, ExpenseCategoryBreakdown>();

    for (const expense of expenses) {
      const category = expense.category_name || 'Uncategorized';
      const current = categoryMap.get(category) || { category, amount: 0, count: 0, percentage: 0 };

      current.amount += expense.amount;
      current.count += 1;
      categoryMap.set(category, current);
    }

    const highestCategories = Array.from(categoryMap.values())
      .map((item) => ({
        ...item,
        amount: roundCurrency(item.amount),
        percentage: totalExpenses > 0 ? roundCurrency((item.amount / totalExpenses) * 100) : 0,
      }))
      .sort(compareDesc((item) => item.amount));

    return {
      totalExpenses,
      expenseCount: expenses.length,
      averageExpense: roundCurrency(safeDivide(totalExpenses, expenses.length)),
      growthRate: percentageChange(totalExpenses, previousTotal),
      highestCategories,
      recurringExpenses: highestCategories.filter((item) => item.count > 1),
      series: transactionsToRevenueSeries(expenses, range).map((point) => ({
        ...point,
        value: point.secondaryValue || 0,
        secondaryValue: undefined,
      })),
    };
  },
};
