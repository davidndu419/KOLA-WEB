import { createBaseEntity, db } from '@/db/dexie';
import type { AuditLog } from '@/db/schema';
import { syncQueueService } from './syncQueueService';
import { getCurrentAuthenticatedUserId } from '@/lib/auth-user';
import { isValidUUID } from '@/lib/uuid';

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

export function buildAuditLog(input: AuditLogInput, userId: string | null, created_at = new Date()): Omit<AuditLog, 'id'> {
  const validUserId = isValidUUID(userId) ? userId : null;

  return {
    ...createBaseEntity(input.business_id),
    sync_status: validUserId ? 'pending' : 'failed',
    user_id: validUserId,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    // Removed previousValue to resolve the error in image_77d561.png
    old_value: input.old_value,
    new_value: input.new_value,
    reason: input.reason,
    created_at,
    updated_at: created_at,
};
}

export const auditLogService = {
  async createAuditLog(input: AuditLogInput) {
    const userId = isValidUUID(input.userId)
      ? input.userId
      : await getCurrentAuthenticatedUserId();
    const log = buildAuditLog(input, userId);
    
    // 1. Save to local Dexie DB
    await db.audit_logs.add(log as any);
    
    // 2. Only cloud-sync audit logs that have a real Supabase user UUID.
    if (isValidUUID(log.user_id)) {
      await syncQueueService.enqueue('audit_logs', 'create', log, input.business_id);
    }
    
    return log;
  },

 async getTransactionAuditTrail(transaction_id: string) {
  return db.audit_logs
    .where('entity_id')
    .equals(transaction_id)
    .reverse() // This already sorts by the primary key/index in reverse
    .toArray();
}
}
export const createAuditLog = auditLogService.createAuditLog;
export const getTransactionAuditTrail = auditLogService.getTransactionAuditTrail;
