// src/services/inventory.service.ts
import { db, createBaseEntity } from '@/db/dexie';
import { Product } from '@/db/schema';
import { adjustStock } from '@/accounting/inventory';
import { syncQueueService } from '@/services/syncQueueService';

export const inventoryService = {
  async addProduct(productData: Omit<Product, keyof import('@/db/schema').BaseEntity | 'id' | 'is_archived'>, business_id: string) {
    const base = createBaseEntity(business_id);
    const product: Product = {
      ...base,
      ...productData,
      is_archived: false,
    };
    
    await db.products.add(product);
    
    // Log initial stock movement if any
    if (product.stock > 0) {
      await adjustStock(
        product.local_id, 
        product.stock, 
        'stock-in', 
        'Initial stock on product creation'
      );
    }
    
    await syncQueueService.enqueue('products', 'create', product, business_id);
    
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

  async restock(product_id: string, quantity: number, cost?: number, note?: string) {
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');
    
    // If cost price changed, update product buying price
    if (cost) {
      await this.updateProduct(product_id, { buying_price: cost });
    }

    return await adjustStock(product_id, quantity, 'stock-in', note, 'Manual restock');
  }
};


