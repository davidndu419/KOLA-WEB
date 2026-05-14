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
  Expense
} from './schema';

export class KolaDatabase extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>;
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
    
    // Version 8: Improved indexing for delta sync and performance
    this.version(8).stores({
      products: '++id, local_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, name',
      transactions: '++id, local_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id',
      sales: '++id, local_id, transaction_id, customer_id, sync_status, updated_at',
      sale_items: '++id, local_id, sale_id, product_id, sync_status, updated_at',
      services: '++id, local_id, transaction_id, customer_id, status, sync_status, updated_at',
      expenses: '++id, local_id, transaction_id, category_id, status, sync_status, updated_at',
      ledger_entries: '++id, local_id, transaction_id, source_type, source_id, debit_account, credit_account, created_at, updated_at, sync_status',
      sync_queue: '++id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, sync_status, updated_at',
      suppliers: '++id, local_id, sync_status, updated_at',
      receivables: '++id, local_id, transaction_id, customer_id, status, sync_status, updated_at',
      app_settings: '++id, key, business_id',
      receipts: '++id, local_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, user_id, action, entity_id, created_at, sync_status'
    }).upgrade(tx => {
      // Future data transformations can be added here
      console.log('Database upgraded to version 8');
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
