import { db } from '@/db/dexie';
import type { SyncQueue } from '@/db/schema';

export function createSyncQueueItem(
  table: string,
  action: SyncQueue['action'],
  data: unknown,
  timestamp = new Date()
): Omit<SyncQueue, 'id'> {
  return {
    table,
    action,
    data,
    timestamp,
    retryCount: 0,
    status: 'pending',
  };
}

export const syncQueueService = {
  enqueue(table: string, action: SyncQueue['action'], data: unknown, timestamp = new Date()) {
    return db.sync_queue.add(createSyncQueueItem(table, action, data, timestamp));
  },

  enqueueMany(items: Omit<SyncQueue, 'id'>[]) {
    return db.sync_queue.bulkAdd(items);
  },
};
