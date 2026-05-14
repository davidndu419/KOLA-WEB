import { db, createBaseEntity } from '../dexie';
import { Sale, SaleItem } from '../schema';
import { BaseRepository } from './base.repository';
import { syncQueueService } from '@/services/syncQueueService';

export class SaleRepository extends BaseRepository<Sale> {
  constructor() {
    super(db.sales, 'sales');
  }

  async createWithItems(
    saleData: Omit<Sale, keyof import('../schema').BaseEntity | 'id' | 'transaction_id'>,
    items: Omit<SaleItem, keyof import('../schema').BaseEntity | 'id' | 'sale_id'>[],
    business_id: string
  ) {
    const base = createBaseEntity(business_id);
    const transaction_id = crypto.randomUUID(); // This links to the main transactions table

    const sale: Sale = {
      ...base,
      ...saleData,
      transaction_id,
      status: 'completed',
    };

    return await db.transaction('rw', [db.sales, db.sale_items, db.sync_queue], async () => {
      // 1. Add Sale
      await db.sales.add(sale);
      await syncQueueService.enqueue('sales', 'create', sale, business_id);

      // 2. Add Sale Items
      const saleItems: SaleItem[] = items.map(item => ({
        ...createBaseEntity(business_id),
        ...item,
        sale_id: sale.local_id,
      }));

      await db.sale_items.bulkAdd(saleItems);
      await syncQueueService.enqueueMany(
        saleItems.map(si => ({ entity: 'sale_items', action: 'create', payload: si, business_id: business_id }))
      );


      return { sale, items: saleItems };
    });
  }

  async getSaleWithItems(local_id: string) {
    const sale = await this.getByLocalId(local_id);
    if (!sale) return null;

    const items = await db.sale_items.where('sale_id').equals(local_id).toArray();
    return { sale, items };
  }
}

export const saleRepository = new SaleRepository();
