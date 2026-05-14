import { createBaseEntity, db } from '@/db/dexie';
import type { AuditLog } from '@/db/schema';
import { createSyncQueueItem } from './syncQueueService';

export interface AuditLogInput {
  business_id: string;
  entity_type: string;
  entity_id: string;
  action: 'created' | 'corrected' | 'reversed' | 'restored' | 'payment_reversed' | 'credit_payment' | string;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string;
  userId?: string;
}

export function buildAuditLog(input: AuditLogInput, created_at = new Date()): Omit<AuditLog, 'id'> {
  return {
    ...createBaseEntity(input.business_id),
    userId: input.userId || 'local-user',
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    previousValue: input.old_value,
    old_value: input.old_value,
    new_value: input.new_value,
    reason: input.reason,
    created_at,
    updated_at: created_at,
  };
}

export const auditLogService = {
  async createAuditLog(input: AuditLogInput) {
    const log = buildAuditLog(input);
    await db.audit_logs.add(log);
    await db.sync_queue.add(createSyncQueueItem('audit_logs', 'create', log, log.created_at));
    return log;
  },

  async getTransactionAuditTrail(transaction_id: string) {
    return db.audit_logs
      .where('entity_id')
      .equals(transaction_id)
      .reverse()
      .toArray();
  },
};

export const createAuditLog = auditLogService.createAuditLog;
export const getTransactionAuditTrail = auditLogService.getTransactionAuditTrail;
