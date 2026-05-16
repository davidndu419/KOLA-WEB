// src/db/dexie.ts
import Dexie, { type Table } from 'dexie';
import { 
  Product, 
  Transaction, 
  LedgerEntry, 
  SyncQueue,
  BaseEntity,
  Category,
  Customer,
  Supplier,
  Receivable,
  Receipt,
  AppSetting,
  AuditLog,
  InventoryMovement,
  Sale,
  SaleItem,
  Service,
  Expense,
  Business,
  ServiceCategory
} from './schema';

export class KolaDatabase extends Dexie {
  businesses!: Table<Business>;
  products!: Table<Product>;
  categories!: Table<Category>;
  service_categories!: Table<ServiceCategory>;
  transactions!: Table<Transaction>;
  sales!: Table<Sale>;
  sale_items!: Table<SaleItem>;
  services!: Table<Service>;
  expenses!: Table<Expense>;
  ledger_entries!: Table<LedgerEntry>;
  sync_queue!: Table<SyncQueue>;
  inventory_movements!: Table<InventoryMovement>;
  customers!: Table<Customer>;
  suppliers!: Table<Supplier>;
  receivables!: Table<Receivable>;
  app_settings!: Table<AppSetting>;
  receipts!: Table<Receipt>;
  audit_logs!: Table<AuditLog>;

  constructor() {
    super('KolaDB');

    this.version(14).stores({
      businesses: '++id, local_id, business_id, user_id, sync_status, updated_at',
      products: '++id, local_id, business_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, business_id, name',
      service_categories: '++id, local_id, business_id, name, status',
      transactions: '++id, local_id, business_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id, customer_id, category_id',
      sales: '++id, local_id, business_id, transaction_id, customer_id, sync_status, created_at, updated_at',
      sale_items: '++id, local_id, business_id, sale_id, product_id, sync_status, created_at, updated_at',
      services: '++id, local_id, business_id, transaction_id, category_id, customer_id, status, sync_status, created_at, updated_at',
      expenses: '++id, local_id, business_id, transaction_id, category_id, status, sync_status, created_at, updated_at',
      ledger_entries: '++id, local_id, business_id, transaction_id, source_type, source_id, debit_account, credit_account, amount, created_at, updated_at, sync_status',
      sync_queue: '++id, business_id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, business_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, business_id, sync_status, updated_at',
      suppliers: '++id, local_id, business_id, sync_status, updated_at',
      receivables: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      app_settings: '++id, business_id, key, [business_id+key], updated_at',
      receipts: '++id, local_id, business_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, business_id, user_id, action, entity_id, created_at, sync_status'
    }).upgrade(async tx => {
      const products = await tx.table('products').toArray();
      for (const product of products) {
        if (product.wac_price === undefined) {
          await tx.table('products').update(product.id, { wac_price: product.buying_price || 0 });
        }
        
        // Backfill movements for this product
        await tx.table('inventory_movements')
          .where('product_id').equals(product.local_id)
          .modify((m: any) => {
            if (m.unit_cost === undefined) {
              // For existing movements, we use the product's current buying price as a best-effort proxy
              m.unit_cost = product.buying_price || 0;
              m.total_cost = (m.unit_cost || 0) * (m.quantity || 0);
            }
          });
      }
    });

    this.version(13).stores({
      businesses: '++id, local_id, business_id, user_id, sync_status, updated_at',
      products: '++id, local_id, business_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, business_id, name',
      service_categories: '++id, local_id, business_id, name, status',
      transactions: '++id, local_id, business_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id, customer_id, category_id',
      sales: '++id, local_id, business_id, transaction_id, customer_id, sync_status, created_at, updated_at',
      sale_items: '++id, local_id, business_id, sale_id, product_id, sync_status, created_at, updated_at',
      services: '++id, local_id, business_id, transaction_id, category_id, customer_id, status, sync_status, created_at, updated_at',
      expenses: '++id, local_id, business_id, transaction_id, category_id, status, sync_status, created_at, updated_at',
      ledger_entries: '++id, local_id, business_id, transaction_id, source_type, source_id, debit_account, credit_account, amount, created_at, updated_at, sync_status',
      sync_queue: '++id, business_id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, business_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, business_id, sync_status, updated_at',
      suppliers: '++id, local_id, business_id, sync_status, updated_at',
      receivables: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      app_settings: '++id, business_id, key, [business_id+key], updated_at',
      receipts: '++id, local_id, business_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, business_id, user_id, action, entity_id, created_at, sync_status'
    });

    this.version(12).stores({
      businesses: '++id, local_id, business_id, user_id, sync_status, updated_at',
      products: '++id, local_id, business_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, business_id, name',
      transactions: '++id, local_id, business_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id, customer_id, category_id',
      sales: '++id, local_id, business_id, transaction_id, customer_id, sync_status, created_at, updated_at',
      sale_items: '++id, local_id, business_id, sale_id, product_id, sync_status, created_at, updated_at',
      services: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      expenses: '++id, local_id, business_id, transaction_id, category_id, status, sync_status, created_at, updated_at',
      ledger_entries: '++id, local_id, business_id, transaction_id, source_type, source_id, debit_account, credit_account, amount, created_at, updated_at, sync_status',
      sync_queue: '++id, business_id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, business_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, business_id, sync_status, updated_at',
      suppliers: '++id, local_id, business_id, sync_status, updated_at',
      receivables: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      app_settings: '++id, business_id, key, [business_id+key], updated_at',
      receipts: '++id, local_id, business_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, business_id, user_id, action, entity_id, created_at, sync_status'
    }).upgrade(async tx => {
      await tx.table('app_settings').toCollection().modify((setting: any) => {
        if (!setting.updated_at) {
          setting.updated_at = new Date();
        }
      });
    });

    this.version(11).stores({
      businesses: '++id, local_id, business_id, user_id, sync_status, updated_at',
      products: '++id, local_id, business_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, business_id, name',
      transactions: '++id, local_id, business_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id, customer_id, category_id',
      sales: '++id, local_id, business_id, transaction_id, customer_id, sync_status, created_at, updated_at',
      sale_items: '++id, local_id, business_id, sale_id, product_id, sync_status, created_at, updated_at',
      services: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      expenses: '++id, local_id, business_id, transaction_id, category_id, status, sync_status, created_at, updated_at',
      ledger_entries: '++id, local_id, business_id, transaction_id, source_type, source_id, debit_account, credit_account, amount, created_at, updated_at, sync_status',
      sync_queue: '++id, business_id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, business_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, business_id, sync_status, updated_at',
      suppliers: '++id, local_id, business_id, sync_status, updated_at',
      receivables: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      app_settings: '++id, business_id, key',
      receipts: '++id, local_id, business_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, business_id, user_id, action, entity_id, created_at, sync_status'
    }).upgrade(async tx => {
      const profiles = (await tx.table('app_settings').toArray()).filter(
        (setting: any) => setting.key === 'business_profile' && setting.value
      );

      for (const setting of profiles) {
        const value = setting.value || {};
        const business_id = value.business_id || value.local_id || setting.business_id;
        if (!business_id) continue;

        const existing = await tx.table('businesses').where('business_id').equals(business_id).first();
        if (existing) continue;

        await tx.table('businesses').add({
          ...value,
          local_id: value.local_id || business_id,
          business_id,
          user_id: value.user_id || '',
          business_name: value.business_name || value.name || 'Kola Business',
          business_type: value.business_type || value.type || 'retail',
          name: value.name || value.business_name || 'Kola Business',
          type: value.type || value.business_type || 'retail',
          currency: value.currency || 'NGN',
          created_at: value.created_at ? new Date(value.created_at) : new Date(),
          updated_at: value.updated_at ? new Date(value.updated_at) : new Date(),
          sync_status: value.sync_status || 'pending',
          version: value.version || 1,
          device_id: value.device_id || 'web-pwa',
        });
      }
    });
    
    // Version 10: Indexing business_id and created_at for robust multi-tenant queries and range reporting
    this.version(10).stores({
      products: '++id, local_id, business_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, business_id, name',
      transactions: '++id, local_id, business_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id, customer_id, category_id',
      sales: '++id, local_id, business_id, transaction_id, customer_id, sync_status, created_at, updated_at',
      sale_items: '++id, local_id, business_id, sale_id, product_id, sync_status, created_at, updated_at',
      services: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      expenses: '++id, local_id, business_id, transaction_id, category_id, status, sync_status, created_at, updated_at',
      ledger_entries: '++id, local_id, business_id, transaction_id, source_type, source_id, debit_account, credit_account, amount, created_at, updated_at, sync_status',
      sync_queue: '++id, business_id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, business_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, business_id, sync_status, updated_at',
      suppliers: '++id, local_id, business_id, sync_status, updated_at',
      receivables: '++id, local_id, business_id, transaction_id, customer_id, status, sync_status, created_at, updated_at',
      app_settings: '++id, business_id, key',
      receipts: '++id, local_id, business_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, business_id, user_id, action, entity_id, created_at, sync_status'
    }).upgrade(tx => {
      console.log('Database upgraded to version 10: Range query and business_id indexes added');
    });


  }
}

export const db = new KolaDatabase();

export function createBaseEntity(business_id: string): Omit<BaseEntity, 'id'> {
  return {
    local_id: crypto.randomUUID(),
    business_id: business_id,
    created_at: new Date(),
    updated_at: new Date(),
    sync_status: 'pending',
    version: 1,
    device_id: 'web-browser', 
  };
}
