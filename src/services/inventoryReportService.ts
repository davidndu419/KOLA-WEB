import { InventoryMovement, Product, Transaction } from '@/db/schema';
import { compareDesc, roundCurrency } from './reportSelectors';

export interface InventoryProductMetric {
  productId: string;
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
    const activeProducts = products.filter((product) => !product.deletedAt && !product.isArchived);
    const productMap = new Map(activeProducts.map((product) => [product.localId, product]));
    const productMetrics = new Map<string, InventoryProductMetric>();

    for (const transaction of transactions.filter((item) => item.type === 'sale')) {
      for (const item of transaction.items || []) {
        const product = productMap.get(item.productId);
        if (!product) continue;
        const current = productMetrics.get(item.productId) || {
          productId: item.productId,
          name: product.name,
          category: product.category,
          quantitySold: 0,
          revenue: 0,
          grossProfit: 0,
          stock: product.stock,
        };
        current.quantitySold += item.quantity;
        current.revenue += item.quantity * item.price;
        current.grossProfit += item.quantity * (item.price - (item.cost ?? product.buyingPrice));
        productMetrics.set(item.productId, current);
      }
    }

    const metrics = Array.from(productMetrics.values()).map((metric) => ({
      ...metric,
      revenue: roundCurrency(metric.revenue),
      grossProfit: roundCurrency(metric.grossProfit),
    }));

    const soldProductIds = new Set(metrics.map((metric) => metric.productId));
    const recentSaleCutoff = new Date(now);
    recentSaleCutoff.setDate(recentSaleCutoff.getDate() - 90);
    const recentlySoldIds = new Set<string>();

    for (const transaction of transactions) {
      if (transaction.createdAt < recentSaleCutoff || transaction.type !== 'sale') continue;
      for (const item of transaction.items || []) recentlySoldIds.add(item.productId);
    }

    const stockInQuantity = inventoryMovements
      .filter((movement) => movement.type === 'stock-in' || movement.type === 'return')
      .reduce((total, movement) => total + movement.quantity, 0);
    const stockOutQuantity = inventoryMovements
      .filter((movement) => movement.type === 'stock-out' || movement.type === 'damage')
      .reduce((total, movement) => total + movement.quantity, 0);

    const stockAges = activeProducts.map((product) => {
      const lastMovement = inventoryMovements
        .filter((movement) => movement.productId === product.localId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const ageSource = lastMovement?.createdAt || product.createdAt;
      return Math.max(0, Math.floor((now.getTime() - ageSource.getTime()) / DAY_MS));
    });

    return {
      inventoryValue: roundCurrency(activeProducts.reduce((total, product) => total + product.stock * product.buyingPrice, 0)),
      retailValue: roundCurrency(activeProducts.reduce((total, product) => total + product.stock * product.sellingPrice, 0)),
      estimatedProfitPotential: roundCurrency(
        activeProducts.reduce((total, product) => total + product.stock * (product.sellingPrice - product.buyingPrice), 0)
      ),
      lowStockProducts: activeProducts.filter((product) => product.stock > 0 && product.stock <= product.minStock),
      deadStockProducts: activeProducts.filter((product) => product.stock > 0 && !recentlySoldIds.has(product.localId) && !soldProductIds.has(product.localId)),
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
