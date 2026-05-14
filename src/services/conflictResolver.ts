import { db } from '@/db/dexie';
import { BaseEntity } from '@/db/schema';

export type ResolutionStrategy = 'server-wins' | 'client-wins' | 'manual';

export class ConflictResolver {
  /**
   * Resolves a conflict between local and remote data.
   * Default strategy: Last Write Wins (based on updated_at)
   */
  async resolve<T extends BaseEntity>(
    table_name: string,
    localItem: T,
    remoteItem: T,
    strategy: ResolutionStrategy = 'client-wins'
  ): Promise<T> {
    console.warn(`[Conflict] Conflict detected in ${table_name} for ID ${localItem.local_id}`);

    if (strategy === 'client-wins') {
      // Keep local version, but ensure it's marked as synced eventually
      return localItem;
    }

    if (strategy === 'server-wins') {
      // Overwrite local with remote
      await (db as any)[table_name].update(localItem.id, remoteItem);
      return remoteItem;
    }

    // Default: Compare timestamps
    const localTime = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
    const remoteTime = remoteItem.updated_at ? new Date(remoteItem.updated_at).getTime() : 0;


    if (localTime >= remoteTime) {
      return localItem;
    } else {
      await (db as any)[table_name].update(localItem.id, remoteItem);
      return remoteItem;
    }
  }
}

export const conflictResolver = new ConflictResolver();
