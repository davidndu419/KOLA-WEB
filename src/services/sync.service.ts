import { db } from '@/db/dexie';
import { supabase } from '@/lib/supabase';
import { SyncQueue } from '@/db/schema';
import { onlineStatusService } from './onlineStatusService';
import { conflictResolver } from './conflictResolver';

const MAX_RETRIES = 5;
const BATCH_SIZE = 20;

// Strict ordering of entities to maintain referential integrity in Supabase
const ENTITY_PRIORITY: Record<string, number> = {
  'businesses': 0,
  'categories': 1,
  'service_categories': 1,
  'expense_categories': 1,
  'customers': 2,
  'suppliers': 3,
  'products': 4,
  'transactions': 5,
  'sales': 6,
  'services': 6,
  'expenses': 6,
  'sale_items': 7,
  'receivables': 7,
  'inventory_movements': 7,
  'ledger_entries': 7,
  'audit_logs': 8,
  'receipts': 8
};

const syncTables = {
  businesses: db.businesses,
  products: db.products,
  sales: db.sales,
  sale_items: db.sale_items,
  expenses: db.expenses,
  services: db.services,
  transactions: db.transactions,
  ledger_entries: db.ledger_entries,
  receivables: db.receivables,
  inventory_movements: db.inventory_movements,
  customers: db.customers,
  suppliers: db.suppliers,
  categories: db.categories,
  service_categories: db.service_categories,
  expense_categories: db.expense_categories,
  audit_logs: db.audit_logs,
  receipts: db.receipts,
} as const;


/**
 * Base Serializer: Returns fields common to all entities.
 */
const serializeBase = (payload: any) => ({
  local_id: payload.local_id,
  business_id: payload.business_id,
  created_at: toIsoDate(payload.created_at),
  updated_at: toIsoDate(payload.updated_at),
  deleted_at: payload.deleted_at ? toIsoDate(payload.deleted_at) : null,
  sync_status: payload.sync_status,
  version: payload.version || 1,
  device_id: payload.device_id || 'unknown',
});

const toIsoDate = (value: any) => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const stripDexieId = (payload: any) => {
  const { id: _, ...clean } = payload;
  return clean;
};

const serializeBusinessForSync = (payload: any) => ({
  ...serializeBase(payload),
  owner_id: payload.user_id,
  name: payload.business_name || payload.name,
});

const serializeLedgerEntryForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  source_type: payload.source_type,
  source_id: payload.source_id,
  debit_account: payload.debit_account,
  credit_account: payload.credit_account,
  amount: payload.amount,
  description: payload.description,
  is_correction: !!payload.is_correction,
  reversal_of_entry_id: payload.reversal_of_entry_id,
  correction_group_id: payload.correction_group_id,
  is_reversal: !!payload.is_reversal,
});

const serializeTransactionForSync = (payload: any) => ({
  ...serializeBase(payload),
  type: payload.type,
  amount: payload.amount,
  payment_method: payload.payment_method,
  status: payload.status,
  reference_id: payload.reference_id,
  customer_id: payload.customer_id,
  customer_name: payload.customer_name,
  category_id: payload.category_id,
  category_name: payload.category_name,
  note: payload.note,
  is_reversed: !!payload.is_reversed,
  is_edited: !!payload.is_edited,
  reversal_reason: payload.reversal_reason,
  original_transaction_id: payload.original_transaction_id,
  source_type: payload.source_type,
  source_id: payload.source_id,
  correction_version: payload.correction_version,
  corrected_at: payload.corrected_at,
});

const serializeSaleForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  customer_id: payload.customer_id,
  total_amount: payload.total_amount,
  discount_amount: payload.discount_amount,
  tax_amount: payload.tax_amount,
  net_amount: payload.net_amount,
  payment_method: payload.payment_method,
  status: payload.status,
  note: payload.note,
});

const serializeSaleItemForSync = (payload: any) => ({
  ...serializeBase(payload),
  sale_id: payload.sale_id,
  product_id: payload.product_id,
  quantity: payload.quantity,
  unit_price: payload.unit_price,
  total_price: payload.total_price,
  cost: payload.cost,
});

const serializeExpenseForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  category_id: payload.category_id,
  category_name: payload.category_name,
  amount: payload.amount,
  payment_method: payload.payment_method,
  recipient: payload.recipient,
  note: payload.note,
  status: payload.status,
});

const serializeReceivableForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  customer_id: payload.customer_id,
  amount: payload.amount,
  paid_amount: payload.paid_amount,
  due_date: payload.due_date,
  status: payload.status,
});

const serializeInventoryMovementForSync = (payload: any) => ({
  ...serializeBase(payload),
  product_id: payload.product_id,
  type: payload.type,
  quantity: payload.quantity,
  previous_stock: payload.previous_stock,
  new_stock: payload.new_stock,
  note: payload.note,
  reason: payload.reason,
  status: payload.status,
});

const serializeProductForSync = (payload: any) => ({
  ...serializeBase(payload),
  name: payload.name,
  sku: payload.sku,
  barcode: payload.barcode,
  category_id: payload.category_id,
  unit_type: payload.unit_type,
  buying_price: payload.buying_price,
  selling_price: payload.selling_price,
  profit_margin: payload.profit_margin,
  stock: payload.stock,
  min_stock: payload.min_stock,
  max_stock: payload.max_stock,
  supplier_id: payload.supplier_id,
  expiry_date: payload.expiry_date,
  image_url: payload.image_url,
  notes: payload.notes,
  tags: payload.tags,
  is_archived: !!payload.is_archived,
});

const serializeServiceCategoryForSync = (payload: any) => ({
  ...serializeBase(payload),
  name: payload.name,
  description: payload.description,
  default_price: payload.default_price,
  status: payload.status,
});

const serializeExpenseCategoryForSync = (payload: any) => ({
  ...serializeBase(payload),
  name: payload.name,
  description: payload.description,
  default_amount: payload.default_amount,
  status: payload.status,
});

/**
 * Main Dispatcher: Strips all local-only or legacy fields.
 */
const serializeForSync = (entity: string, payload: any) => {
  switch (entity) {
    case 'businesses': return serializeBusinessForSync(payload);
    case 'ledger_entries': return serializeLedgerEntryForSync(payload);
    case 'transactions': return serializeTransactionForSync(payload);
    case 'sales': return serializeSaleForSync(payload);
    case 'sale_items': return serializeSaleItemForSync(payload);
    case 'expenses': return serializeExpenseForSync(payload);
    case 'receivables': return serializeReceivableForSync(payload);
    case 'inventory_movements': return serializeInventoryMovementForSync(payload);
    case 'products': return serializeProductForSync(payload);
    case 'service_categories': return serializeServiceCategoryForSync(payload);
    case 'expense_categories': return serializeExpenseCategoryForSync(payload);
    default:
      return stripDexieId(payload);
  }
};



export const syncService = {
  isProcessing: false,
  isFullSyncing: false,

  async updateMetadata(business_id: string, key: string, value: any) {
    const matches = await db.app_settings
      .where('[business_id+key]')
      .equals([business_id, key])
      .toArray();
    const [existing, ...duplicates] = matches.sort((a, b) => {
      const left = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const right = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return right - left;
    });

    if (existing) {
      await db.app_settings.update(existing.id!, { value, updated_at: new Date() });
    } else {
      await db.app_settings.add({ business_id, key, value, updated_at: new Date() });
    }

    if (duplicates.length > 0) {
      await db.app_settings.bulkDelete(duplicates.map((setting) => setting.id!).filter(Boolean));
    }
  },

  async getQueueDiagnostics(business_id: string) {
    const queue = await db.sync_queue
      .where('business_id')
      .equals(business_id)
      .toArray();

    const pendingItems = queue.filter((item) => item.status === 'pending' || item.status === 'syncing');
    const failedItems = queue.filter((item) => item.status === 'failed');
    const firstProblem = failedItems[0] || pendingItems[0] || null;

    return {
      pendingCount: pendingItems.length,
      failedCount: failedItems.length,
      firstProblem,
      items: queue.sort((a, b) => {
        const left = a.created_at ? new Date(a.created_at).getTime() : 0;
        const right = b.created_at ? new Date(b.created_at).getTime() : 0;
        return left - right;
      }),
    };
  },

  async retryFailed(business_id: string) {
    await db.sync_queue
      .where('business_id')
      .equals(business_id)
      .filter((item) => item.status === 'failed')
      .modify({ status: 'pending', error: undefined });
  },

  async clearFailedItem(id: number) {
    const item = await db.sync_queue.get(id);
    if (!item || item.status !== 'failed') {
      throw new Error('Only failed sync items can be cleared');
    }
    await db.sync_queue.delete(id);
  },

  async processQueue(business_id?: string) {
    if (this.isProcessing || !onlineStatusService.getOnlineStatus()) return;
    
    this.isProcessing = true;
    
    const firstItem = business_id
      ? await db.sync_queue.where('business_id').equals(business_id).first()
      : await db.sync_queue.limit(1).first();
    const activeBusinessId = business_id || firstItem?.business_id;

    if (activeBusinessId) {
      // Auto-recovery for businesses schema mismatch
      await db.sync_queue
        .where('entity').equals('businesses')
        .and(item => !!(item.status === 'failed' && (item.error?.includes('business_name') || item.error?.includes('PGRST204'))))
        .modify({ status: 'pending', retry_count: 0, error: undefined });

      await db.sync_queue
        .where('business_id')
        .equals(activeBusinessId)
        .filter((item) => item.status === 'syncing')
        .modify({
          status: 'pending',
          error: 'Recovered stale syncing item from an interrupted sync run',
        });
      await this.updateMetadata(activeBusinessId, 'last_sync_attempt_at', new Date().toISOString());
      await this.updateMetadata(activeBusinessId, 'last_sync_status', 'syncing');
    }


    try {
      // Fetch more than BATCH_SIZE so we can sort them and still have a good batch
      let items = await db.sync_queue.where('status').anyOf(['pending', 'failed']).limit(100).toArray();
      if (activeBusinessId) {
        items = items.filter((item) => item.business_id === activeBusinessId);
      }

      if (items.length === 0) {
        this.isProcessing = false;
        if (activeBusinessId) {
          const failedCount = await db.sync_queue.where('business_id').equals(activeBusinessId).filter((item) => item.status === 'failed').count();
          await this.updateMetadata(activeBusinessId, 'last_sync_status', failedCount > 0 ? 'failed' : 'synced');
          if (failedCount === 0) {
            await this.updateMetadata(activeBusinessId, 'last_successful_sync_at', new Date().toISOString());
          }
        }
        return;
      }

      // Sort by priority first, then by creation date
      const sortedItems = items.sort((a, b) => {
        const priorityA = ENTITY_PRIORITY[a.entity] || 99;
        const priorityB = ENTITY_PRIORITY[b.entity] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      });

      // Take only the first BATCH_SIZE after sorting
      const batch = sortedItems.slice(0, BATCH_SIZE);

      for (const item of batch) {
        await this.syncItem(item);
      }

      const remainingPending = await db.sync_queue
        .where('status')
        .equals('pending')
        .filter((item) => !activeBusinessId || item.business_id === activeBusinessId)
        .count();
      const failedCount = await db.sync_queue
        .where('status')
        .equals('failed')
        .filter((item) => !activeBusinessId || item.business_id === activeBusinessId)
        .count();

      if (remainingPending > 0) {
        if (activeBusinessId) {
          await this.updateMetadata(activeBusinessId, 'last_sync_status', 'pending');
        }
      } else if (activeBusinessId) {
        await this.updateMetadata(activeBusinessId, 'last_sync_status', failedCount > 0 ? 'failed' : 'synced');
        if (failedCount === 0) {
          await this.updateMetadata(activeBusinessId, 'last_successful_sync_at', new Date().toISOString());
        }
      }
    } catch (error: any) {
      console.error('[SyncService] Error processing queue:', error);
      if (activeBusinessId) {
        await this.updateMetadata(activeBusinessId, 'last_sync_status', 'failed');
        await this.updateMetadata(activeBusinessId, 'last_sync_error', error.message || 'Unknown error');
      }
    } finally {
      this.isProcessing = false;
    }
  },

  async syncItem(item: SyncQueue) {
    const { entity, action, payload, id, retry_count } = item;
    
    try {
      if (!item.business_id || !entity || !action || !payload || !item.entity_id) {
        throw new Error('Invalid sync queue item');
      }

      const localTable = syncTables[entity as keyof typeof syncTables] as any;
      if (!localTable) {
        throw new Error(`Unsupported sync entity: ${entity}`);
      }

      await db.sync_queue.update(id!, { status: 'syncing' });

      let result;
      switch (action) {
        case 'create':
        case 'update':
          const syncPayload = serializeForSync(entity, payload);
          result = await supabase.from(entity).upsert(syncPayload, { onConflict: 'local_id' });
          break;

        case 'delete':
          result = await supabase.from(entity).delete().eq('local_id', item.entity_id);
          break;
      }

      if (result?.error) {
        const details = [
          result.error.message,
          result.error.details,
          result.error.hint,
          result.error.code,
        ].filter(Boolean).join(' | ');
        throw new Error(details || 'Supabase sync failed');
      }

      // Success: Remove from queue and mark local as synced
      await db.sync_queue.delete(id!);
      
      const localItem = await localTable.where('local_id').equals(item.entity_id).first();
      if (localItem) {
        await localTable.update(localItem.id, { sync_status: 'synced', updated_at: new Date() });
      }

    } catch (error: any) {

      const newRetryCount = retry_count + 1;
      const status = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
      await db.sync_queue.update(id!, { 
        status,
        retry_count: newRetryCount,
        error: error.message || error.details || 'Unknown error'
      });
    }
  },

  async pullFromCloud(business_id: string) {
    if (!onlineStatusService.getOnlineStatus()) return;

    const tables = Object.keys(ENTITY_PRIORITY).sort((a, b) => ENTITY_PRIORITY[a] - ENTITY_PRIORITY[b]);

    for (const table of tables) {
      // Get last sync time for this table
      const syncKey = `last_sync_${table}`;
      const lastSyncSetting = await db.app_settings
        .where('business_id')
        .equals(business_id)
        .filter((setting) => setting.key === syncKey)
        .first();
      const lastSyncTime = lastSyncSetting?.value || new Date(0).toISOString();

      // Delta Pull: Only get records updated since last sync
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('business_id', business_id)
        .gt('updated_at', lastSyncTime)
        .order('updated_at', { ascending: true })
        .limit(200); // Paginated pull

      if (error) {
        console.error(`[SyncService] Error pulling ${table}:`, error);
        continue;
      }

      if (data && data.length > 0) {
        for (const remoteItem of data) {
          const localTable = syncTables[table as keyof typeof syncTables] as any;
          if (!localTable) continue;
          const { id: _remoteId, ...remoteWithoutId } = remoteItem as any;

          const localItem = await localTable.where('local_id').equals((remoteItem as any).local_id).first();

          
          // Convert string dates to Date objects for Dexie
          const processedItem: any = {
            ...remoteWithoutId,
            created_at: (remoteItem as any).created_at ? new Date((remoteItem as any).created_at) : new Date(),
            updated_at: (remoteItem as any).updated_at ? new Date((remoteItem as any).updated_at) : new Date(),
            deleted_at: (remoteItem as any).deleted_at ? new Date((remoteItem as any).deleted_at) : null,
            sync_status: 'synced'
          };

          if (localItem) {
            // Local exists: Check for conflict
            if (localItem.sync_status === 'pending' || localItem.sync_status === 'failed') {
               await conflictResolver.resolve(table, localItem, processedItem);
            } else {
               // Safe to overwrite local with newer cloud data
               await localTable.update(localItem.id, processedItem);
            }
          } else {
            // New from cloud
            await localTable.add(processedItem);
          }
        }

        // Update last sync time to the latest record's updated_at
        const latestTime = (data[data.length - 1] as any).updated_at;

        if (lastSyncSetting) {
          await db.app_settings.update(lastSyncSetting.id!, { value: latestTime, updated_at: new Date() });
        } else {
          await db.app_settings.add({ business_id, key: syncKey, value: latestTime, updated_at: new Date() });
        }
      }
    }
  },

  async runFullSync(business_id: string) {
    if (this.isFullSyncing || !onlineStatusService.getOnlineStatus()) return false;

    this.isFullSyncing = true;
    await this.updateMetadata(business_id, 'last_sync_attempt_at', new Date().toISOString());
    await this.updateMetadata(business_id, 'last_sync_status', 'syncing');

    try {
      await this.processQueue(business_id);
      await this.pullFromCloud(business_id);

      const pendingCount = await db.sync_queue
        .where('business_id')
        .equals(business_id)
        .filter((item) => item.status === 'pending' || item.status === 'syncing')
        .count();
      const failedCount = await db.sync_queue
        .where('business_id')
        .equals(business_id)
        .filter((item) => item.status === 'failed')
        .count();

      if (pendingCount > 0) {
        await this.updateMetadata(business_id, 'last_sync_status', 'pending');
        return false;
      }

      if (failedCount > 0) {
        await this.updateMetadata(business_id, 'last_sync_status', 'failed');
        return false;
      }

      await this.updateMetadata(business_id, 'last_successful_sync_at', new Date().toISOString());
      await this.updateMetadata(business_id, 'last_sync_status', 'synced');
      await this.updateMetadata(business_id, 'last_sync_error', null);
      return true;
    } catch (error: any) {
      await this.updateMetadata(business_id, 'last_sync_status', 'failed');
      await this.updateMetadata(business_id, 'last_sync_error', error.message || 'Unknown error');
      throw error;
    } finally {
      this.isFullSyncing = false;
    }
  }

};
