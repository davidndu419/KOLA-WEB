import { db } from '../dexie';
import { Receivable } from '../schema';
import { BaseRepository } from './base.repository';

export class ReceivableRepository extends BaseRepository<Receivable> {
  constructor() {
    super(db.receivables, 'receivables');
  }

  async getPending(business_id: string) {
    return await this.table
      .where('business_id')
      .equals(business_id)
      .filter(r => r.status !== 'paid' && !r.deleted_at)
      .toArray();
  }

  async getByCustomer(customer_id: string) {
    return await this.table
      .where('customer_id')
      .equals(customer_id)
      .and(r => !r.deleted_at)
      .toArray();
  }
}

export const receivableRepository = new ReceivableRepository();
