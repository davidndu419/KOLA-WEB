import { db } from '../dexie';
import { Product } from '../schema';
import { BaseRepository } from './base.repository';

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super(db.products, 'products');
  }

  async getByCategory(business_id: string, category_id: string) {
    return await this.table
      .where('business_id')
      .equals(business_id)
      .filter(p => p.category_id === category_id && !p.deleted_at)
      .toArray();
  }

  async updateStock(local_id: string, new_stock: number) {
    return await this.update(local_id, { stock: new_stock } as Partial<Product>);
  }

  async search(business_id: string, query: string) {
    const q = query.toLowerCase();
    return await this.table
      .where('business_id')
      .equals(business_id)
      .filter(p => {
  const isNotDeleted = !p.deleted_at;
  const matchesQuery = p.name.toLowerCase().includes(q.toLowerCase()) ||  !!(p.sku && p.sku.toLowerCase().includes(q.toLowerCase()));
  return !!(isNotDeleted && matchesQuery);
})
      .toArray();
  }
}

export const productRepository = new ProductRepository();
