import { db } from '@/db/dexie';
import type { SyncQueue } from '@/db/schema';

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleImmediatePush(business_id: string) {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  const existing = pushTimers.get(business_id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pushTimers.delete(business_id);
    import('@/services/sync.service')
      .then(({ syncService }) => syncService.requestImmediateSync(business_id))
      .catch((error) => console.warn('[SyncQueue] Immediate background push failed:', error));
  }, 0);

  pushTimers.set(business_id, timer);
}

export const syncQueueService = {
  createItem(
    entity: string,
    action: SyncQueue['action'],
    payload: any,
    business_id: string,
  ): Omit<SyncQueue, 'id'> {
    const entity_id = payload?.local_id || payload?.business_id || payload?.id?.toString();
    if (!business_id || !entity || !action || !payload || !entity_id) {
      throw new Error(`Invalid sync queue item for ${entity || 'unknown entity'}`);
    }

    return {
      business_id,
      entity,
      entity_id,
      action,
      payload,
      status: 'pending',
      retry_count: 0,
      created_at: new Date(),
    };
  },

  async enqueue(entity: string, action: SyncQueue['action'], payload: any, business_id: string) {
    const item = this.createItem(entity, action, payload, business_id);
    const id = await db.sync_queue.add(item as SyncQueue);
    scheduleImmediatePush(business_id);
    return id;
  },

  async enqueueMany(items: { entity: string; action: SyncQueue['action']; payload: any; business_id: string }[]) {
    const syncItems = items.map(item => this.createItem(item.entity, item.action, item.payload, item.business_id));
    const ids = await db.sync_queue.bulkAdd(syncItems as SyncQueue[]);
    Array.from(new Set(items.map((item) => item.business_id))).forEach(scheduleImmediatePush);
    return ids;
  },
};
