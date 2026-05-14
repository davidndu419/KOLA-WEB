import { db } from '../dexie';
import { InventoryMovement } from '../schema';
import { BaseRepository } from './base.repository';

export class InventoryRepository extends BaseRepository<InventoryMovement> {
  constructor() {
    super(db.inventory_movements, 'inventory_movements');
  }

  async getMovementsByProduct(product_id: string) {
    return await this.table
      .where('product_id')
      .equals(product_id)
      .reverse()
      .toArray();
  }

  async getRecentMovements(business_id: string, limit = 50) {
    return await this.table
      .where('business_id')
      .equals(business_id)
      .reverse()
      .limit(limit)
      .toArray();
  }
}

export const inventoryRepository = new InventoryRepository();
