import { db } from '@/db/dexie';
import { AuditLog, Customer, LedgerEntry, Product, Receivable, Transaction } from '@/db/schema';
import { analyticsService, PaymentBreakdown, RankedItem } from './analyticsService';
import { ExpenseAnalytics, expenseService } from './expenseService';
import { InventoryReport, inventoryReportService } from './inventoryReportService';
import { ProfitLossReport, profitLossService } from './profitLossService';
import { ReceivableReport, receivableReportService } from './receivableReportService';
import { RevenueAnalytics, revenueService } from './revenueService';
import {
  isActiveTransaction,
  ReportFilters,
  ReportRange,
  ResolvedReportRange,
  resolveReportDateRange,
  roundCurrency,
  transactionMatchesFilters,
} from './reportSelectors';

export interface TransactionHistoryItem {
  transaction: Transaction;
  title: string;
  subtitle: string;
  ledgerImpact: {
    debits: number;
    credits: number;
    entries: LedgerEntry[];
  };
  auditTrail: AuditLog[];
  items: {
    product_id: string;
    name: string;
    quantity: number;
    price: number;
    cost?: number;
  }[];
}

export interface ReportsSnapshot {
  range: ResolvedReportRange;
  revenue: RevenueAnalytics;
  expenses: ExpenseAnalytics;
  profitLoss: ProfitLossReport;
  inventory: InventoryReport;
  receivables: ReceivableReport;
  paymentBreakdown: PaymentBreakdown;
  sales: ReturnType<typeof analyticsService.sales>;
  services: ReturnType<typeof analyticsService.services>;
  cashFlow: ReturnType<typeof analyticsService.cashFlow>;
  topSellingProducts: RankedItem[];
  bestPerformingServices: RankedItem[];
  mostProfitableItems: RankedItem[];
  transactions: TransactionHistoryItem[];
  summary: {
    totalRevenue: number;
    totalSales: number;
    totalServiceIncome: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    inventoryValue: number;
    totalReceivables: number;
    totalTransactions: number;
    averageTransactionValue: number;
  };
}

async function rangeTransactions(startDate: Date, endDate: Date) {
  if (startDate.getTime() === 0) {
    return (await db.transactions.toArray()).filter(isActiveTransaction);
  }

  return (await db.transactions.where('created_at').between(startDate, endDate, true, true).toArray()).filter(isActiveTransaction);
}

async function rangeLedger(startDate: Date, endDate: Date) {
  if (startDate.getTime() === 0) {
    return (await db.ledger_entries.toArray()).filter((entry) => !entry.deleted_at);
  }

  return (await db.ledger_entries.where('created_at').between(startDate, endDate, true, true).toArray()).filter((entry) => !entry.deleted_at);
}

function applyFilters(transactions: Transaction[], filters?: ReportFilters) {
  return transactions.filter((transaction) => transactionMatchesFilters(transaction, filters));
}

function formatTransactionTitle(transaction: Transaction) {
  if (transaction.type === 'sale') return 'Product sale';
  if (transaction.type === 'service') return transaction.note || 'Service income';
  return transaction.category || 'Expense';
}

function buildHistory(
  transactions: Transaction[],
  products: Product[],
  ledgerEntries: LedgerEntry[],
  auditLogs: AuditLog[],
  limit = 250
): TransactionHistoryItem[] {
  const productMap = new Map(products.map((product) => [product.local_id, product]));
  const ledgerMap = new Map<string, LedgerEntry[]>();
  const auditMap = new Map<string, AuditLog[]>();

  for (const entry of ledgerEntries) {
    const existing = ledgerMap.get(entry.transaction_id) || [];
    existing.push(entry);
    ledgerMap.set(entry.transaction_id, existing);
  }

  for (const log of auditLogs) {
    const existing = auditMap.get(log.entity_id) || [];
    existing.push(log);
    auditMap.set(log.entity_id, existing);
  }

  return transactions
    .slice()
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit)
    .map((transaction) => {
      const entries = ledgerMap.get(transaction.local_id) || [];
      const joinedTransaction = transaction as Transaction & { items: any[] };
      return {
        transaction,
        title: formatTransactionTitle(transaction),
        subtitle: [(transaction as any).customer, transaction.payment_method, transaction.status].filter(Boolean).join(' | '),
        ledgerImpact: {
          debits: roundCurrency(entries.reduce((total, entry) => total + entry.amount, 0)),
          credits: roundCurrency(entries.reduce((total, entry) => total + entry.amount, 0)),
          entries,
        },
        auditTrail: auditMap.get(transaction.local_id) || [],
        items: (joinedTransaction.items || []).map((item) => ({
          ...item,
          name: productMap.get(item.product_id)?.name || 'Archived product',
        })),
      };
    });

}

export const reportsService = {
  async getSnapshot(
    rangeId: ReportRange,
    customStartDate?: Date,
    customEndDate?: Date,
    filters?: ReportFilters
  ): Promise<ReportsSnapshot> {
    const range = resolveReportDateRange(rangeId, customStartDate, customEndDate);

    const [
      currentTransactionsRaw,
      previousTransactionsRaw,
      currentLedgerRaw,
      previousLedgerRaw,
      allLedger,
      products,
      inventoryMovements,
      receivables,
      customers,
      auditLogs,
      salesRaw,
      saleItemsRaw,
    ] = await Promise.all([
      rangeTransactions(range.startDate, range.endDate),
      rangeTransactions(range.previousStartDate, range.previousEndDate),
      rangeLedger(range.startDate, range.endDate),
      rangeLedger(range.previousStartDate, range.previousEndDate),
      db.ledger_entries.toArray(),
      db.products.toArray(),
      db.inventory_movements.toArray(),
      db.receivables.toArray(),
      db.customers.toArray(),
      db.audit_logs.toArray(),
      db.sales.toArray(),
      db.sale_items.toArray(),
    ]);

    const transactions = applyFilters(currentTransactionsRaw, filters);
    const previousTransactions = applyFilters(previousTransactionsRaw, filters);
    const transaction_ids = new Set(transactions.map((transaction) => transaction.local_id));
    const previousTransactionIds = new Set(previousTransactions.map((transaction) => transaction.local_id));
    const currentLedger = currentLedgerRaw.filter((entry) => transaction_ids.has(entry.transaction_id) || entry.debit_account === 'Receivables' || entry.credit_account === 'Receivables');
    const previousLedger = previousLedgerRaw.filter((entry) => previousTransactionIds.has(entry.transaction_id) || entry.debit_account === 'Receivables' || entry.credit_account === 'Receivables');

    // Enrich transactions with items for downstream services
    const saleMap = new Map(salesRaw.map(s => [s.transaction_id, s]));
    const saleItemMap = new Map<string, any[]>();
    for (const item of saleItemsRaw) {
      const existing = saleItemMap.get(item.sale_id) || [];
      existing.push(item);
      saleItemMap.set(item.sale_id, existing);
    }

    transactions.forEach(t => {
      const sale = saleMap.get(t.local_id);
      if (sale) {
        (t as any).items = saleItemMap.get(sale.local_id) || [];
      } else {
        (t as any).items = [];
      }
    });

    previousTransactions.forEach(t => {
      const sale = saleMap.get(t.local_id);
      if (sale) {
        (t as any).items = saleItemMap.get(sale.local_id) || [];
      } else {
        (t as any).items = [];
      }
    });

    const revenue = revenueService.analyze(transactions, previousTransactions, range);
    const expenses = expenseService.analyze(transactions, previousTransactions, range);
    const profitLoss = profitLossService.calculate(transactions, currentLedger, previousTransactions, previousLedger);
    const inventory = inventoryReportService.analyze(products, transactions, inventoryMovements);
    const receivableLedger = allLedger.filter((entry) => entry.debit_account === 'Receivables' || entry.credit_account === 'Receivables' || entry.debit_account === 'Cash' || entry.credit_account === 'Cash' || entry.debit_account === 'Bank' || entry.credit_account === 'Bank');
    const receivablesReport = receivableReportService.analyze(receivables as Receivable[], customers as Customer[], receivableLedger);
    const sales = analyticsService.sales(transactions, products);
    const services = analyticsService.services(transactions);
    const paymentBreakdown = analyticsService.paymentBreakdown(transactions);
    const cashFlow = analyticsService.cashFlow(transactions, currentLedger, previousTransactions);
    const mostProfitableItems = analyticsService.mostProfitableProducts(transactions, products);

    return {
      range,
      revenue,
      expenses,
      profitLoss,
      inventory,
      receivables: receivablesReport,
      paymentBreakdown,
      sales,
      services,
      cashFlow,
      topSellingProducts: sales.topSellingProducts,
      bestPerformingServices: services.topServices,
      mostProfitableItems,
      transactions: buildHistory(transactions, products, [...currentLedger, ...allLedger], auditLogs),
      summary: {
        totalRevenue: revenue.totalRevenue,
        totalSales: sales.totalSalesValue,
        totalServiceIncome: services.serviceRevenue,
        totalExpenses: expenses.totalExpenses,
        grossProfit: profitLoss.grossProfit,
        netProfit: profitLoss.netProfit,
        inventoryValue: inventory.inventoryValue,
        totalReceivables: receivablesReport.totalOutstanding,
        totalTransactions: transactions.length,
        averageTransactionValue: revenue.averageTransactionValue,
      },
    };
  },
};
