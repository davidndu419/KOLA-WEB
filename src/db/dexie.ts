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
  InventoryMovement
} from './schema';

export class KolaDatabase extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;
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
    
    this.version(5).stores({
      products: '++id, localId, name, category, syncStatus, isArchived, updatedAt',
      categories: '++id, localId, name',
      transactions: '++id, localId, type, paymentMethod, status, syncStatus, createdAt, isEdited, isReversed, originalTransactionId',
      ledger_entries: '++id, localId, transactionId, accountName, createdAt, isReversal, isCorrection',
      sync_queue: '++id, table, status, timestamp, createdAt',
      inventory_movements: '++id, localId, productId, type, createdAt, status',
      customers: '++id, localId, name, phone',
      suppliers: '++id, localId, name',
      receivables: '++id, localId, transactionId, customerId, status',
      app_settings: '++id, key',
      receipts: '++id, localId, transactionId',
      audit_logs: '++id, localId, timestamp, userId, action, entityId'
    });
  }
}

export const db = new KolaDatabase();

/**
 * Solvency Guard & Database Helpers
 */

// Helper to create base entity fields
export function createBaseEntity(businessId: string): Omit<BaseEntity, 'id'> {
  return {
    localId: crypto.randomUUID(),
    businessId,
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'pending',
    version: 1,
    deviceId: 'web-browser', // In production, generate/retrieve a persistent device ID
  };
}
