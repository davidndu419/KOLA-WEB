import { db } from '@/db/dexie';
import type { SyncQueue } from '@/db/schema';
import { INVALID_USER_IDENTIFIER_ERROR, isValidUUID } from '@/lib/uuid';

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_INVALID_IDENTIFIER_RETRIES = 5;

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
  hasInvalidUserIdentifier(entity: string, payload: any) {
    if (entity === 'audit_logs') {
      return !isValidUUID(payload?.user_id);
    }

    if (entity === 'businesses') {
      return !isValidUUID(payload?.owner_id || payload?.user_id);
    }

    return false;
  },

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
      status: this.hasInvalidUserIdentifier(entity, payload) ? 'failed' : 'pending',
      retry_count: this.hasInvalidUserIdentifier(entity, payload) ? MAX_INVALID_IDENTIFIER_RETRIES : 0,
      error: this.hasInvalidUserIdentifier(entity, payload) ? INVALID_USER_IDENTIFIER_ERROR : undefined,
      created_at: new Date(),
    };
  },

  async enqueue(entity: string, action: SyncQueue['action'], payload: any, business_id: string) {
    const item = this.createItem(entity, action, payload, business_id);
    const id = await db.sync_queue.add(item as SyncQueue);
    if (item.status === 'pending') {
      scheduleImmediatePush(business_id);
    }
    return id;
  },

  async enqueueMany(items: { entity: string; action: SyncQueue['action']; payload: any; business_id: string }[]) {
    const syncItems = items.map(item => this.createItem(item.entity, item.action, item.payload, item.business_id));
    const ids = await db.sync_queue.bulkAdd(syncItems as SyncQueue[]);
    Array.from(new Set(syncItems
      .filter((item) => item.status === 'pending')
      .map((item) => item.business_id)
    )).forEach(scheduleImmediatePush);
    return ids;
  },
};
