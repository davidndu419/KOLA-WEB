// src/hooks/use-inventory-metrics.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';

export function useInventoryMetrics() {
  return useLiveQuery(async () => {
    const products = await db.products
      .filter((product) => !product.isArchived)
      .toArray();
    
    let totalValue = 0;
    let potentialProfit = 0;
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    
    products.forEach(p => {
      const stock = p.stock || 0;
      totalValue += (p.buyingPrice * stock);
      potentialProfit += ((p.sellingPrice - p.buyingPrice) * stock);
      totalUnits += stock;
      
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= p.minStock) {
        lowStockCount++;
      }
    });

    // Fast-moving detection (placeholder logic for now, could use transaction frequency)
    const fastMoving = products
      .filter(p => p.stock > 0 && p.stock < p.minStock * 2)
      .slice(0, 3);

    return {
      totalValue,
      potentialProfit,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      totalProducts: products.length,
      fastMoving
    };
  }, []);
}
