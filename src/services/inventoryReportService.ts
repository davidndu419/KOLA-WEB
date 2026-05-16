import { InventoryMovement, Product, Transaction } from '@/db/schema';
import { compareDesc, roundCurrency } from './reportSelectors';

export interface InventoryProductMetric {
  product_id: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: number;
  grossProfit: number;
  stock: number;
}

export interface InventoryReport {
  inventoryValue: number;
  retailValue: number;
  estimatedProfitPotential: number;
  lowStockProducts: Product[];
  deadStockProducts: Product[];
  fastMovingProducts: InventoryProductMetric[];
  mostProfitableItems: InventoryProductMetric[];
  stockMovementCount: number;
  stockInQuantity: number;
  stockOutQuantity: number;
  averageStockAgeDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const inventoryReportService = {
  analyze(
    products: Product[],
    transactions: Transaction[],
    inventoryMovements: InventoryMovement[],
    now = new Date()
  ): InventoryReport {
    const activeProducts = products.filter((product) => !product.deleted_at && !product.is_archived);
    const productMap = new Map(activeProducts.map((product) => [product.local_id, product]));
    const productMetrics = new Map<string, InventoryProductMetric>();

    for (const transaction of transactions.filter((item) => item.type === 'sale')) {
      const transactionItems = (transaction as any).items || [];
      for (const item of transactionItems) {

        const product = productMap.get(item.product_id);
        if (!product) continue;
        const current = productMetrics.get(item.product_id) || {
          product_id: item.product_id,
          name: product.name,
          category: product.category_id || '',
          quantitySold: 0,
          revenue: 0,
          grossProfit: 0,
          stock: product.stock,
        };
        current.quantitySold += item.quantity;
        current.revenue += item.quantity * item.price;
        const costBasis = product.wac_price ?? product.buying_price ?? 0;
        current.grossProfit += item.quantity * (item.price - (item.cost || costBasis));
        productMetrics.set(item.product_id, current);
      }
    }

    const metrics = Array.from(productMetrics.values()).map((metric) => ({
      ...metric,
      revenue: roundCurrency(metric.revenue),
      grossProfit: roundCurrency(metric.grossProfit),
    }));

    const soldProductIds = new Set(metrics.map((metric) => metric.product_id));
    const recentSaleCutoff = new Date(now);
    recentSaleCutoff.setDate(recentSaleCutoff.getDate() - 90);
    const recentlySoldIds = new Set<string>();

    for (const transaction of transactions) {
      if (transaction.created_at < recentSaleCutoff || transaction.type !== 'sale') continue;
      const items = (transaction as any).items || [];
      for (const item of items) recentlySoldIds.add(item.product_id);
    }


    const stockInQuantity = inventoryMovements
      .filter((movement) => movement.type === 'stock-in' || movement.type === 'return')
      .reduce((total, movement) => total + movement.quantity, 0);
    const stockOutQuantity = inventoryMovements
      .filter((movement) => movement.type === 'stock-out' || movement.type === 'damage')
      .reduce((total, movement) => total + movement.quantity, 0);

    const stockAges = activeProducts.map((product) => {
      const lastMovement = inventoryMovements
        .filter((movement) => movement.product_id === product.local_id)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
      const ageSource = lastMovement?.created_at || product.created_at;
      return Math.max(0, Math.floor((now.getTime() - ageSource.getTime()) / DAY_MS));
    });

    return {
      inventoryValue: roundCurrency(activeProducts.reduce((total, product) => total + product.stock * (product.wac_price ?? product.buying_price ?? 0), 0)),
      retailValue: roundCurrency(activeProducts.reduce((total, product) => total + product.stock * product.selling_price, 0)),
      estimatedProfitPotential: roundCurrency(
        activeProducts.reduce((total, product) => total + product.stock * (product.selling_price - (product.wac_price ?? product.buying_price ?? 0)), 0)
      ),
      lowStockProducts: activeProducts.filter((product) => product.stock > 0 && product.stock <= product.min_stock),
      deadStockProducts: activeProducts.filter((product) => product.stock > 0 && !recentlySoldIds.has(product.local_id) && !soldProductIds.has(product.local_id)),
      fastMovingProducts: metrics.sort(compareDesc((metric) => metric.quantitySold)).slice(0, 5),
      mostProfitableItems: metrics.sort(compareDesc((metric) => metric.grossProfit)).slice(0, 5),
      stockMovementCount: inventoryMovements.length,
      stockInQuantity,
      stockOutQuantity,
      averageStockAgeDays: stockAges.length
        ? Math.round(stockAges.reduce((total, age) => total + age, 0) / stockAges.length)
        : 0,
    };
  },
};
