import { createBaseEntity, db } from '@/db/dexie';
import type { AuditLog } from '@/db/schema';
import { createSyncQueueItem } from './syncQueueService';

export interface AuditLogInput {
  businessId: string;
  entityType: string;
  entityId: string;
  action: 'created' | 'corrected' | 'reversed' | 'restored' | 'payment_reversed' | 'credit_payment' | string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  userId?: string;
}

export function buildAuditLog(input: AuditLogInput, createdAt = new Date()): Omit<AuditLog, 'id'> {
  return {
    ...createBaseEntity(input.businessId),
    userId: input.userId || 'local-user',
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    previousValue: input.oldValue,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reason: input.reason,
    createdAt,
    updatedAt: createdAt,
  };
}

export const auditLogService = {
  async createAuditLog(input: AuditLogInput) {
    const log = buildAuditLog(input);
    await db.audit_logs.add(log);
    await db.sync_queue.add(createSyncQueueItem('audit_logs', 'create', log, log.createdAt));
    return log;
  },

  async getTransactionAuditTrail(transactionId: string) {
    return db.audit_logs
      .where('entityId')
      .equals(transactionId)
      .reverse()
      .toArray();
  },
};

export const createAuditLog = auditLogService.createAuditLog;
export const getTransactionAuditTrail = auditLogService.getTransactionAuditTrail;
