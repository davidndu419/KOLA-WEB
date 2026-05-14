import { db } from '@/db/dexie';
import { resolveReportDateRange, ReportRange } from './reportSelectors';

export interface ProfitLossReport {
  revenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export interface InventoryValuation {
  totalItems: number;
  totalQuantity: number;
  totalValue: number; // Cost value
  potentialValue: number; // Selling value
}

export const reportService = {
  /**
   * Optimized P&L using .each() for memory efficiency with large datasets
   */
  async getProfitLoss(range: ReportRange, customDate?: Date): Promise<ProfitLossReport> {
    const { startDate, endDate } = resolveReportDateRange(range, customDate);

    let revenue = 0;
    let serviceRevenue = 0;
    let cogs = 0;
    let expenses = 0;

    await db.ledger_entries
      .where('created_at')
      .between(startDate, endDate)
      .each((entry: any) => {
  if (entry.credit_account === 'Revenue') revenue += entry.amount;
  else if (entry.credit_account === 'Service Revenue') serviceRevenue += entry.amount;
  else if (entry.debit_account === 'COGS') cogs += entry.amount;
  else if (entry.debit_account === 'Expenses') expenses += entry.amount;
});

    const totalRevenue = revenue + serviceRevenue;
    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - expenses;

    return {
      revenue,
      serviceRevenue,
      totalRevenue,
      cogs,
      grossProfit,
      expenses,
      netProfit
    };
  },

  /**
   * Optimized Inventory Valuation using indexed filtering
   */
  async getInventoryValuation(): Promise<InventoryValuation> {
    let totalItems = 0;
    let totalQuantity = 0;
    let totalValue = 0;
    let potentialValue = 0;

    // Use index on is_archived for performance
    await db.products
      .where('is_archived')
      .equals(0) // 0 for false in Dexie/SQLite usually or false boolean
      .each(p => {
        if (p.deleted_at) return;
        totalItems++;
        totalQuantity += p.stock;
        totalValue += p.stock * p.buying_price;
        potentialValue += p.stock * p.selling_price;
      });

    return {
      totalItems,
      totalQuantity,
      totalValue,
      potentialValue
    };
  },

  /**
   * Optimized Receivables Summary
   */
  async getReceivablesSummary() {
    let totalOwed = 0;
    let count = 0;

    await db.receivables
      .where('status')
      .anyOf(['pending', 'partially-paid'])
      .each(r => {
        if (r.deleted_at) return;
        totalOwed += (r.amount - r.paid_amount);
        count++;
      });
    
    return { totalOwed, count };
  },

  /**
   * Optimized Cash Flow calculation
   */
  async getCashFlow(range: ReportRange, customDate?: Date) {
    const { startDate, endDate } = resolveReportDateRange(range, customDate);
    
    let cashIn = 0;
    let cashOut = 0;

    await db.ledger_entries
      .where('created_at')
      .between(startDate, endDate)
      .each((entry: any) => {
  if (entry.debit_account === 'Cash' || entry.debit_account === 'Bank') cashIn += entry.amount;
  if (entry.credit_account === 'Cash' || entry.credit_account === 'Bank') cashOut += entry.amount;
});

    return { cashIn, cashOut, netCash: cashIn - cashOut };
  },

  async getDashboardSummary() {
    const [pnL, receivables, inventory] = await Promise.all([
      this.getProfitLoss('today'),
      this.getReceivablesSummary(),
      this.getInventoryValuation()
    ]);

    return {
      todayRevenue: pnL.totalRevenue,
      todayProfit: pnL.netProfit,
      totalReceivables: receivables.totalOwed,
      inventoryValue: inventory.totalValue,
    };
  }
};
