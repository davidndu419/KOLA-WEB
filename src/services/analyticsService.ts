import { LedgerEntry, Product, Transaction } from '@/db/schema';
import { toDonutSegments } from './chartTransformers';
import { compareDesc, isRestockTransaction, percentageChange, roundCurrency, safeDivide } from './reportSelectors';

export interface RankedItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface PaymentBreakdown {
  cash: number;
  transfer: number;
  credit: number;
  segments: ReturnType<typeof toDonutSegments>;
}

export interface CashFlowAnalytics {
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  transferInflow: number;
  creditImpact: number;
  trendChange: number;
}

export interface SalesAnalytics {
  totalSalesCount: number;
  totalSalesValue: number;
  averageSaleValue: number;
  creditSalesValue: number;
  topSellingProducts: RankedItem[];
}

export interface ServiceAnalytics {
  serviceRevenue: number;
  serviceCount: number;
  averageServiceValue: number;
  serviceProfitability: number;
  topServices: RankedItem[];
}

function productRanking(transactions: Transaction[], products: Product[]): RankedItem[] {
  const productMap = new Map(products.map((product) => [product.local_id, product]));
  const rankings = new Map<string, RankedItem>();

  for (const transaction of transactions.filter((item) => item.type === 'sale')) {
    const transactionItems = (transaction as Transaction & { items: any[] }).items || [];

    for (const item of transactionItems) {
      const product = productMap.get(item.product_id);
      const current = rankings.get(item.product_id) || {
        id: item.product_id,
        name: product?.name || 'Archived product',
        quantity: 0,
        revenue: 0,
        profit: 0,
      };

      current.quantity += item.quantity;
      current.revenue += item.quantity * item.unit_price;
      current.profit += item.quantity * (item.unit_price - (item.cost_price || product?.buying_price || 0));
      rankings.set(item.product_id, current);
    }
  }


  return Array.from(rankings.values())
    .map((item) => ({
      ...item,
      revenue: roundCurrency(item.revenue),
      profit: roundCurrency(item.profit),
    }))
    .sort(compareDesc((item) => item.quantity));
}

function serviceRanking(transactions: Transaction[]): RankedItem[] {
  const rankings = new Map<string, RankedItem>();

  for (const transaction of transactions.filter((item) => item.type === 'service')) {
    const name = transaction.note?.trim() || 'Service';
    const key = name.toLowerCase();
    const current = rankings.get(key) || {
      id: key,
      name,
      quantity: 0,
      revenue: 0,
      profit: 0,
    };

    current.quantity += 1;
    current.revenue += transaction.amount;
    current.profit += transaction.amount;
    rankings.set(key, current);
  }

  return Array.from(rankings.values())
    .map((item) => ({
      ...item,
      revenue: roundCurrency(item.revenue),
      profit: roundCurrency(item.profit),
    }))
    .sort(compareDesc((item) => item.revenue));
}

export const analyticsService = {
  sales(transactions: Transaction[], products: Product[]): SalesAnalytics {
    const sales = transactions.filter((transaction) => transaction.type === 'sale');
    const totalSalesValue = roundCurrency(sales.reduce((total, transaction) => total + transaction.amount, 0));

    return {
      totalSalesCount: sales.length,
      totalSalesValue,
      averageSaleValue: roundCurrency(safeDivide(totalSalesValue, sales.length)),
      creditSalesValue: roundCurrency(
        sales.filter((transaction) => transaction.payment_method === 'credit').reduce((total, transaction) => total + transaction.amount, 0)
      ),
      topSellingProducts: productRanking(transactions, products).slice(0, 5),
    };
  },

  services(transactions: Transaction[]): ServiceAnalytics {
    const services = transactions.filter((transaction) => transaction.type === 'service');
    const serviceRevenue = roundCurrency(services.reduce((total, transaction) => total + transaction.amount, 0));

    return {
      serviceRevenue,
      serviceCount: services.length,
      averageServiceValue: roundCurrency(safeDivide(serviceRevenue, services.length)),
      serviceProfitability: serviceRevenue,
      topServices: serviceRanking(transactions).slice(0, 5),
    };
  },

  paymentBreakdown(transactions: Transaction[]): PaymentBreakdown {
    const income = transactions.filter((transaction) => transaction.type === 'sale' || transaction.type === 'service');
    const cash = roundCurrency(income.filter((transaction) => transaction.payment_method === 'cash').reduce((total, transaction) => total + transaction.amount, 0));
    const transfer = roundCurrency(
      income.filter((transaction) => transaction.payment_method === 'transfer').reduce((total, transaction) => total + transaction.amount, 0)
    );
    const credit = roundCurrency(income.filter((transaction) => transaction.payment_method === 'credit').reduce((total, transaction) => total + transaction.amount, 0));

    return {
      cash,
      transfer,
      credit,
      segments: toDonutSegments([
        { key: 'cash', label: 'Cash', value: cash, colorClass: 'bg-emerald-500' },
        { key: 'transfer', label: 'Transfer', value: transfer, colorClass: 'bg-blue-500' },
        { key: 'credit', label: 'Credit', value: credit, colorClass: 'bg-amber-500' },
      ]),
    };
  },

  mostProfitableProducts(transactions: Transaction[], products: Product[]) {
    return productRanking(transactions, products).sort(compareDesc((item) => item.profit)).slice(0, 5);
  },

  cashFlow(transactions: Transaction[], ledgerEntries: LedgerEntry[], previousTransactions: Transaction[]): CashFlowAnalytics {
    const cashInflow = roundCurrency(
      transactions
        .filter((transaction) => (transaction.type === 'sale' || transaction.type === 'service') && transaction.payment_method === 'cash')
        .reduce((total, transaction) => total + transaction.amount, 0)
    );
    const transferInflow = roundCurrency(
      transactions
        .filter((transaction) => (transaction.type === 'sale' || transaction.type === 'service') && transaction.payment_method === 'transfer')
        .reduce((total, transaction) => total + transaction.amount, 0)
    );
    const cashOutflow = roundCurrency(
      transactions
        .filter((transaction) => transaction.type === 'expense' && !isRestockTransaction(transaction))
        .reduce((total, transaction) => total + transaction.amount, 0)
    );
    const creditImpact = roundCurrency(
      transactions
        .filter((transaction) => (transaction.type === 'sale' || transaction.type === 'service') && transaction.payment_method === 'credit')
        .reduce((total, transaction) => total + transaction.amount, 0)
    );
    const paymentRecoveries = roundCurrency(
      ledgerEntries.filter((entry) => entry.credit_account === 'Receivables').reduce((total, entry) => total + entry.amount, 0)
    );


    const previousCashFlow = roundCurrency(
      previousTransactions
        .filter((transaction) => transaction.type === 'sale' || transaction.type === 'service')
        .filter((transaction) => transaction.payment_method !== 'credit')
        .reduce((total, transaction) => total + transaction.amount, 0) -
        previousTransactions
          .filter((transaction) => transaction.type === 'expense' && !isRestockTransaction(transaction))
          .reduce((total, transaction) => total + transaction.amount, 0)
    );
    const netCashFlow = roundCurrency(cashInflow + transferInflow + paymentRecoveries - cashOutflow);

    return {
      cashInflow: roundCurrency(cashInflow + paymentRecoveries),
      cashOutflow,
      netCashFlow,
      transferInflow,
      creditImpact,
      trendChange: percentageChange(netCashFlow, previousCashFlow),
    };
  },
};
