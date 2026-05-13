// src/services/inventory.service.ts
import { db, createBaseEntity } from '@/db/dexie';
import { Product, InventoryMovement } from '@/db/schema';
import { adjustStock } from '@/accounting/inventory';

export const inventoryService = {
  async addProduct(productData: Omit<Product, keyof import('@/db/schema').BaseEntity | 'id'>, businessId: string) {
    const base = createBaseEntity(businessId);
    const product: Product = {
      ...base,
      ...productData,
      isArchived: false,
    };
    
    await db.products.add(product);
    
    // Log initial stock movement if any
    if (product.stock > 0) {
      await adjustStock(
        product.localId, 
        product.stock, 
        'stock-in', 
        'Initial stock on product creation'
      );
    }
    
    await db.sync_queue.add({
      table: 'products',
      action: 'create',
      data: product,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    });
    
    return product;
  },

  async updateProduct(localId: string, updates: Partial<Product>) {
    const product = await db.products.where('localId').equals(localId).first();
    if (!product) throw new Error('Product not found');

    const updatedProduct = {
      ...product,
      ...updates,
      updatedAt: new Date(),
      syncStatus: 'pending' as const
    };

    await db.products.update(product.id!, updatedProduct);

    await db.sync_queue.add({
      table: 'products',
      action: 'update',
      data: updatedProduct,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    });

    return updatedProduct;
  },

  async deleteProduct(localId: string) {
    const product = await db.products.where('localId').equals(localId).first();
    if (!product) throw new Error('Product not found');

    // Archive instead of delete to preserve transaction history
    await this.updateProduct(localId, { isArchived: true });
  },

  async restock(productId: string, quantity: number, costPrice?: number, note?: string) {
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');
    
    // If cost price changed, update product buying price
    if (costPrice) {
      await this.updateProduct(productId, { buyingPrice: costPrice });
    }

    return await adjustStock(productId, quantity, 'stock-in', note, 'Manual restock');
  }
};
