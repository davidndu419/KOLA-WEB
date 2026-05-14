import { db } from '@/db/dexie';
import { supabase } from '@/lib/supabase';
import { SyncQueue } from '@/db/schema';
import { onlineStatusService } from './onlineStatusService';
import { conflictResolver } from './conflictResolver';

const MAX_RETRIES = 5;
const BATCH_SIZE = 20;

// Strict ordering of entities to maintain referential integrity in Supabase
const ENTITY_PRIORITY: Record<string, number> = {
  'categories': 1,
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

export const syncService = {
  isProcessing: false,

  async processQueue() {
    if (this.isProcessing || !onlineStatusService.getOnlineStatus()) return;
    
    this.isProcessing = true;

    try {
      // Fetch more than BATCH_SIZE so we can sort them and still have a good batch
      const items = await db.sync_queue
        .where('status')
        .anyOf(['pending', 'failed'])
        .limit(100)
        .toArray();

      if (items.length === 0) {
        this.isProcessing = false;
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

      // Check if there are more
      const remaining = await db.sync_queue.where('status').anyOf(['pending', 'failed']).count();
      if (remaining > 0) {
        setTimeout(() => this.processQueue(), 500);
      }
    } catch (error) {
      console.error('[SyncService] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  },

  async syncItem(item: SyncQueue) {
    const { entity, action, payload, id, retry_count } = item;
    
    try {
      await db.sync_queue.update(id!, { status: 'syncing' });

      let result;
      switch (action) {
        case 'create':
        case 'update':
          // Ensure we don't send local ++id to Supabase if it exists in payload
          const { id: _, ...syncPayload } = payload;
          result = await supabase.from(entity).upsert(syncPayload, { onConflict: 'local_id' });
          break;
        case 'delete':
          result = await supabase.from(entity).delete().eq('local_id', item.entity_id);
          break;
      }

      if (result?.error) throw result.error;

      // Success: Remove from queue and mark local as synced
      await db.sync_queue.delete(id!);
      
      const localTable = (db as any)[entity];
      if (localTable) {
        const localItem = await localTable.where('local_id').equals(item.entity_id).first();
        if (localItem) {
          await localTable.update(localItem.id, { sync_status: 'synced', updated_at: new Date() });
        }
      }

    } catch (error: any) {
      const newRetryCount = retry_count + 1;
      const status = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
      await db.sync_queue.update(id!, { 
        status,
        retry_count: newRetryCount,
        error: error.message || 'Unknown error'
      });
    }
  },

  async pullFromCloud(business_id: string) {
    if (!onlineStatusService.getOnlineStatus()) return;

    const tables = Object.keys(ENTITY_PRIORITY).sort((a, b) => ENTITY_PRIORITY[a] - ENTITY_PRIORITY[b]);

    for (const table of tables) {
      // Get last sync time for this table
      const syncKey = `last_sync_${table}`;
      const lastSyncSetting = await db.app_settings.where('key').equals(syncKey).first();
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
          const localTable = (db as any)[table];
          const localItem = await localTable.where('local_id').equals((remoteItem as any).local_id).first();
          
          // Convert string dates to Date objects for Dexie
          const processedItem: any = {
            ...(remoteItem as object),
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
  }

};
