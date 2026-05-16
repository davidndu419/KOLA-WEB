// src/services/inventory.service.ts
import { db, createBaseEntity } from '@/db/dexie';
import { Product } from '@/db/schema';
import { adjustStock } from '@/accounting/inventory';
import { syncQueueService } from '@/services/syncQueueService';

export const inventoryService = {
  async addProduct(productData: Omit<Product, keyof import('@/db/schema').BaseEntity | 'id' | 'is_archived'>, business_id: string) {
    const initialStock = productData.stock || 0;
    const base = createBaseEntity(business_id);
    
    // Create product with 0 stock initially to avoid double-counting 
    // when calling adjustStock for the initial inventory entry
    const product: Product = {
      ...base,
      ...productData,
      stock: 0,
      is_archived: false,
      wac_price: productData.wac_price ?? productData.buying_price ?? 0,
    };
    
    await db.products.add(product);
    
    // Enqueue create event with 0 stock first
    await syncQueueService.enqueue('products', 'create', product, business_id);
    
    // Log initial stock movement via adjustStock if quantity > 0
    // This will update the stock from 0 -> initialStock and record history/ledger
    if (initialStock > 0) {
      await adjustStock(
        product.local_id, 
        initialStock, 
        'stock-in', 
        'Initial stock on product creation',
        'Initial Stock',
        product.wac_price
      );
      
      // Update local object to reflect the final stock for return value
      product.stock = initialStock;
    }
    
    return product;
  },

  async updateProduct(local_id: string, updates: Partial<Product>) {
    const product = await db.products.where('local_id').equals(local_id).first();
    if (!product) throw new Error('Product not found');

    const updatedProduct = {
      ...product,
      ...updates,
      updated_at: new Date(),
      sync_status: 'pending' as const
    };

    // If buying_price was manually updated but wac_price wasn't, sync them
    if (updates.buying_price !== undefined && updates.wac_price === undefined) {
      updatedProduct.wac_price = updates.buying_price;
    }

    await db.products.update(product.id!, updatedProduct);
    await syncQueueService.enqueue('products', 'update', updatedProduct, product.business_id);

    return updatedProduct;
  },

  async deleteProduct(local_id: string) {
    const product = await db.products.where('local_id').equals(local_id).first();
    if (!product) throw new Error('Product not found');

    // Archive instead of delete to preserve transaction history
    await this.updateProduct(local_id, { is_archived: true });
  },

  async unarchiveProduct(local_id: string) {
    await this.updateProduct(local_id, { is_archived: false });
  },

  async restock(product_id: string, quantity: number, cost?: number, note?: string) {
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');
    
    const product = await db.products.where('local_id').equals(product_id).first();
    if (!product) throw new Error('Product not found');

    const addedUnitCost = cost || product.buying_price || 0;
    const currentQty = product.stock || 0;
    const currentWac = product.wac_price ?? product.buying_price ?? 0;

    // WAC Formula: ((currentQty * currentWac) + (addedQty * addedUnitCost)) / (currentQty + addedQty)
    const newTotalValue = (currentQty * currentWac) + (quantity * addedUnitCost);
    const newTotalQty = currentQty + quantity;
    const newWac = newTotalQty > 0 ? newTotalValue / newTotalQty : addedUnitCost;

    // Update product: stock is updated by adjustStock later, but we update pricing here
    await this.updateProduct(product_id, { 
      buying_price: addedUnitCost, // Latest cost
      wac_price: newWac 
    });

    // Automatically record an expense for the restock
    // Note: We do this before adjustStock so we can pass skipLedger: true
    // ensuring the accounting impact (Debit Inventory, Credit Cash) 
    // is handled by the expense transaction, not the adjustment.
    await import('./finance.service').then(m => m.financeService.recordExpense({
      amount: quantity * addedUnitCost,
      category_id: 'restock-category',
      category_name: 'Restock',
      payment_method: 'cash', // Default to cash for now
      note: `Restock: ${product.name} — ${quantity} ${product.unit_type}s @ ₦${addedUnitCost.toLocaleString()}`,
      source_type: 'restock',
      source_id: product_id
    }, product.business_id));

    return await adjustStock(product_id, quantity, 'stock-in', note, 'Manual restock', addedUnitCost, true);
  }
};


