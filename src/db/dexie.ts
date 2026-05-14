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


    // Version 9: Migrating LedgerEntry to single-row debit/credit pair and standardizing Transaction fields
    this.version(9).stores({
      products: '++id, local_id, category_id, sync_status, is_archived, updated_at',
      categories: '++id, local_id, name',
      transactions: '++id, local_id, type, payment_method, status, sync_status, created_at, updated_at, reference_id, customer_id, category_id',
      sales: '++id, local_id, transaction_id, customer_id, sync_status, updated_at',
      sale_items: '++id, local_id, sale_id, product_id, sync_status, updated_at',
      services: '++id, local_id, transaction_id, customer_id, status, sync_status, updated_at',
      expenses: '++id, local_id, transaction_id, category_id, status, sync_status, updated_at',
      ledger_entries: '++id, local_id, transaction_id, source_type, source_id, debit_account, credit_account, amount, created_at, updated_at, sync_status',
      sync_queue: '++id, entity, entity_id, status, created_at',
      inventory_movements: '++id, local_id, product_id, type, created_at, updated_at, sync_status',
      customers: '++id, local_id, sync_status, updated_at',
      suppliers: '++id, local_id, sync_status, updated_at',
      receivables: '++id, local_id, transaction_id, customer_id, status, sync_status, updated_at',
      app_settings: '++id, key, business_id',
      receipts: '++id, local_id, transaction_id, sync_status, updated_at',
      audit_logs: '++id, local_id, user_id, action, entity_id, created_at, sync_status'
    }).upgrade(async tx => {
      // Migrate Ledger Entries from version 8 format
      await tx.table('ledger_entries').toCollection().modify((entry: any) => {
        if (entry.account_name && (entry.debit > 0 || entry.credit > 0)) {
          // Map old multi-row format to new single-row format where possible
          // Note: This is an estimation since old data was split into two rows.
          // In a real migration, we'd try to pair them, but for safety we'll just populate what we can.
          entry.debit_account = entry.debit > 0 ? entry.account_name : 'Unknown';
          entry.credit_account = entry.credit > 0 ? entry.account_name : 'Unknown';
          entry.amount = entry.debit || entry.credit;
          
          delete entry.account_name;
          delete entry.debit;
          delete entry.credit;
        }
      });

      // Migrate Transactions
      await tx.table('transactions').toCollection().modify((tx: any) => {
        if (tx.customer && !tx.customer_name) tx.customer_name = tx.customer;
        if (tx.category && !tx.category_name) tx.category_name = tx.category;
        delete tx.customer;
        delete tx.category;
      });

      console.log('Database upgraded to version 9: Schema standardized');
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
