import { db, createBaseEntity } from '../dexie';
import { syncQueueService } from '@/services/syncQueueService';
import type { BaseEntity } from '../schema';
import type { Table } from 'dexie';

export abstract class BaseRepository<T extends BaseEntity> {
  protected table: Table<T, number>;
  protected table_name: string;

  constructor(table: Table<T, number>, table_name: string) {
    this.table = table;
    this.table_name = table_name;
  }

  async getAll(business_id: string): Promise<T[]> {
    return await this.table
      .where('business_id')
      .equals(business_id)
      .and(item => !item.deleted_at)
      .toArray();
  }

  async getByLocalId(local_id: string): Promise<T | undefined> {
    return await this.table.where('local_id').equals(local_id).first();
  }

  async create(data: Omit<T, keyof BaseEntity | 'id'>, business_id: string): Promise<T> {
    const base = createBaseEntity(business_id);
    const entity = {
      ...base,
      ...data,
    } as unknown as T;

    await this.table.add(entity);
    await syncQueueService.enqueue(this.table_name, 'create', entity, business_id);
    
    return entity;
  }

  async update(local_id: string, updates: Partial<T>): Promise<T> {
    const existing = await this.getByLocalId(local_id);
    if (!existing) throw new Error(`${this.table_name} not found: ${local_id}`);

    const updatedEntity = {
      ...existing,
      ...updates,
      updated_at: new Date(),
      sync_status: 'pending' as const
    };

    await this.table.update(existing.id!, updatedEntity);
    await syncQueueService.enqueue(this.table_name, 'update', updatedEntity, existing.business_id);

    return updatedEntity;
  }

  async delete(local_id: string): Promise<void> {
    const existing = await this.getByLocalId(local_id);
    if (!existing) throw new Error(`${this.table_name} not found: ${local_id}`);

    // Soft delete
    const updatedEntity = {
      ...existing,
      deleted_at: new Date(),
      updated_at: new Date(),
      sync_status: 'pending' as const
    };

    await this.table.update(existing.id!, updatedEntity);
    await syncQueueService.enqueue(this.table_name, 'update', updatedEntity, existing.business_id);
  }

  /**
   * Optimistic Update Helper
   */
  async optimisticUpdate(local_id: string, updates: Partial<T>, callback: (updated: T) => void) {
    const updated = await this.update(local_id, updates);
    callback(updated);
    return updated;
  }
}
