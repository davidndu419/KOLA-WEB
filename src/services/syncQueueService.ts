import { db } from '@/db/dexie';
import type { SyncQueue } from '@/db/schema';

export const syncQueueService = {
  createItem(
    entity: string,
    action: SyncQueue['action'],
    payload: any,
    business_id: string,
  ): Omit<SyncQueue, 'id'> {
    return {
      business_id,
      entity,
      entity_id: payload.local_id || payload.id?.toString(),
      action,
      payload,
      status: 'pending',
      retry_count: 0,
      created_at: new Date(),
    };
  },

  async enqueue(entity: string, action: SyncQueue['action'], payload: any, business_id: string) {
    const item = this.createItem(entity, action, payload, business_id);
    return await db.sync_queue.add(item as SyncQueue);
  },

  async enqueueMany(items: { entity: string; action: SyncQueue['action']; payload: any; business_id: string }[]) {
    const syncItems = items.map(item => this.createItem(item.entity, item.action, item.payload, item.business_id));
    return await db.sync_queue.bulkAdd(syncItems as SyncQueue[]);
  },
};



