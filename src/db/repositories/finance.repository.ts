import { db } from '../dexie';
import { Expense, Service } from '../schema';
import { BaseRepository } from './base.repository';

export class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super(db.expenses, 'expenses');
  }

  async getByCategory(business_id: string, category_id: string) {
    return await this.table
      .where('business_id')
      .equals(business_id)
      .filter(e => e.category_id === category_id)
      .toArray();
  }
}

export class ServiceRepository extends BaseRepository<Service> {
  constructor() {
    super(db.services, 'services');
  }

  async getByCustomer(customer_id: string) {
    return await this.table.where('customer_id').equals(customer_id).toArray();
  }
}

export const expenseRepository = new ExpenseRepository();
export const serviceRepository = new ServiceRepository();
