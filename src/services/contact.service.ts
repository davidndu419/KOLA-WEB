import { db, createBaseEntity } from '@/db/dexie';
import { Customer, Supplier } from '@/db/schema';
import { syncQueueService } from '@/services/syncQueueService';

export const contactService = {
  // Customers
  async addCustomer(data: Omit<Customer, keyof import('@/db/schema').BaseEntity | 'id' | 'total_debt'>, business_id: string) {
    const customer: Customer = {
      ...createBaseEntity(business_id),
      ...data,
      total_debt: 0,
    };
    await db.customers.add(customer);
    await syncQueueService.enqueue('customers', 'create', customer, business_id);
    return customer;
  },

  async updateCustomer(local_id: string, updates: Partial<Customer>) {
    const customer = await db.customers.where('local_id').equals(local_id).first();
    if (!customer) throw new Error('Customer not found');

    const updatedCustomer = {
      ...customer,
      ...updates,
      updated_at: new Date(),
      sync_status: 'pending' as const
    };
    await db.customers.update(customer.id!, updatedCustomer);
    await syncQueueService.enqueue('customers', 'update', updatedCustomer, customer.business_id);
    return updatedCustomer;
  },

  async getCustomerHistory(customer_id: string) {
    const transactions = await db.transactions
      .where('customer_id')
      .equals(customer_id)
      .reverse()
      .toArray();
    
    const receivables = await db.receivables
      .where('customer_id')
      .equals(customer_id)
      .toArray();

    return { transactions, receivables };
  },

  // Suppliers
  async addSupplier(data: Omit<Supplier, keyof import('@/db/schema').BaseEntity | 'id' | 'total_balance'>, business_id: string) {
   const supplier: Supplier = {
    ...createBaseEntity(business_id),
    ...data,
    // Ensure this matches your schema (e.g., balance or totalBalance)
    balance: 0, 
} as any;
    await db.suppliers.add(supplier);
    await syncQueueService.enqueue('suppliers', 'create', supplier, business_id);
    return supplier;
  },

  async updateSupplier(local_id: string, updates: Partial<Supplier>) {
    const supplier = await db.suppliers.where('local_id').equals(local_id).first();
    if (!supplier) throw new Error('Supplier not found');

    const updatedSupplier = {
      ...supplier,
      ...updates,
      updated_at: new Date(),
      sync_status: 'pending' as const
    };
    await db.suppliers.update(supplier.id!, updatedSupplier);
    await syncQueueService.enqueue('suppliers', 'update', updatedSupplier, supplier.business_id);
    return updatedSupplier;
  }
};
