import { db } from '@/db/dexie';
import { supabase } from '@/lib/supabase';
import { SyncQueue } from '@/db/schema';
import { onlineStatusService } from './onlineStatusService';
import { conflictResolver } from './conflictResolver';
import { getStorageKeys } from '@/lib/runtime-mode';
import { safeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { clearGhostAuthState, ensureSupabaseSession, SESSION_EXPIRED_MESSAGE } from './sessionRecovery';

const MAX_RETRIES = 5;
const BATCH_SIZE = 20;
const STALE_SYNC_MS = 60_000;
const LOCKED_SYNC_RETRY_MS = 750;
const RLS_SELF_HEAL_THRESHOLD = 2;
const STALE_USER_DATA_PREFIX = 'blocked/stale-user-data';
const autoRetriedBusinesses = new Set<string>();
const requestedSyncBusinesses = new Set<string>();
const requestedSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const autoHealedRlsBusinesses = new Set<string>();

// Mode-specific sync lock and instance keys
const getSyncLockKey = () => getStorageKeys().syncLock;
const getInstanceIdKey = () => getStorageKeys().syncInstanceId;

type SyncLock = {
  owner: string;
  business_id: string;
  started_at: string;
  heartbeat_at: string;
};

type SyncPreflightContext = {
  currentUserId: string | null;
  activeBusinessId: string | null;
  queueBusinessId: string | null;
  entity: string;
  ownershipMismatch: boolean;
  localBusinessUserId?: string | null;
  cloudBusinessOwnerId?: string | null;
  reason?: string;
};

const isBrowser = () => typeof window !== 'undefined';

const getInstanceId = () => {
  if (!isBrowser()) return 'server';

  const key = getInstanceIdKey();
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;

  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
};

const readSyncLock = (): SyncLock | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(getSyncLockKey());
    return raw ? JSON.parse(raw) as SyncLock : null;
  } catch {
    return null;
  }
};

const getLockAge = (lock: SyncLock | null) => {
  if (!lock) return 0;
  return Date.now() - safeTime(lock.heartbeat_at || lock.started_at);
};

const isStaleLock = (lock: SyncLock | null) => !!lock && getLockAge(lock) > STALE_SYNC_MS;

const writeSyncLock = (business_id: string) => {
  if (!isBrowser()) return null;

  const now = new Date().toISOString();
  const lock: SyncLock = {
    owner: getInstanceId(),
    business_id,
    started_at: now,
    heartbeat_at: now,
  };
  window.localStorage.setItem(getSyncLockKey(), JSON.stringify(lock));
  return lock;
};

const clearSyncLock = (owner?: string) => {
  if (!isBrowser()) return;

  const current = readSyncLock();
  if (!current || !owner || current.owner === owner || isStaleLock(current)) {
    window.localStorage.removeItem(getSyncLockKey());
  }
};

const heartbeatSyncLock = async (business_id: string, owner: string) => {
  const current = readSyncLock();
  if (!current || current.owner !== owner) return;

  const heartbeat = new Date().toISOString();
  window.localStorage.setItem(getSyncLockKey(), JSON.stringify({ ...current, heartbeat_at: heartbeat }));
  try {
    await syncService.updateMetadata(business_id, 'last_sync_heartbeat_at', heartbeat);
  } catch (error) {
    console.warn('[SyncService] Unable to write sync heartbeat metadata:', error);
  }
};

const acquireSyncLock = (business_id: string) => {
  if (!isBrowser()) return { acquired: true, owner: 'server' };

  const current = readSyncLock();
  const instanceId = getInstanceId();
  if (current && current.owner !== instanceId && !isStaleLock(current)) {
    return { acquired: false, owner: current.owner };
  }

  if (current && isStaleLock(current)) {
    clearSyncLock();
  }

  const lock = writeSyncLock(business_id);
  return { acquired: true, owner: lock?.owner || instanceId };
};

// Strict ordering of entities to maintain referential integrity in Supabase
const ENTITY_PRIORITY: Record<string, number> = {
  'businesses': 0,
  'categories': 1,
  'service_categories': 1,
  'expense_categories': 1,
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

const syncTables = {
  businesses: db.businesses,
  products: db.products,
  sales: db.sales,
  sale_items: db.sale_items,
  expenses: db.expenses,
  services: db.services,
  transactions: db.transactions,
  ledger_entries: db.ledger_entries,
  receivables: db.receivables,
  inventory_movements: db.inventory_movements,
  customers: db.customers,
  suppliers: db.suppliers,
  categories: db.categories,
  service_categories: db.service_categories,
  expense_categories: db.expense_categories,
  audit_logs: db.audit_logs,
  receipts: db.receipts,
} as const;


/**
 * Base Serializer: Returns fields common to all entities.
 */
const serializeBase = (payload: any) => ({
  local_id: payload.local_id,
  business_id: payload.business_id,
  created_at: toIsoDate(payload.created_at),
  updated_at: toIsoDate(payload.updated_at),
  deleted_at: payload.deleted_at ? toIsoDate(payload.deleted_at) : null,
  sync_status: payload.sync_status,
  version: payload.version || 1,
  device_id: payload.device_id || 'unknown',
});

const toIsoDate = (value: any) => {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

const stripDexieId = (payload: any) => {
  const { id: _, ...clean } = payload;
  return clean;
};

const roundTo = (value: any, decimals: number) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const factor = 10 ** decimals;
  return Number((Math.round((numeric + Number.EPSILON) * factor) / factor).toFixed(decimals));
};

const roundMoney = (value: any) => roundTo(value, 2);
const roundCost = (value: any) => roundTo(value, 4);

const formatSyncContext = (context: SyncPreflightContext) => [
  `currentUserId=${context.currentUserId || 'missing'}`,
  `activeBusinessId=${context.activeBusinessId || 'missing'}`,
  `queueItemBusinessId=${context.queueBusinessId || 'missing'}`,
  `entity=${context.entity || 'unknown'}`,
  `ownershipMismatch=${context.ownershipMismatch ? 'yes' : 'no'}`,
  `localBusinessUserId=${context.localBusinessUserId || 'missing'}`,
  `cloudBusinessOwnerId=${context.cloudBusinessOwnerId || 'missing'}`,
  context.reason ? `reason=${context.reason}` : null,
].filter(Boolean).join(' | ');

const buildStaleUserDataError = (context: SyncPreflightContext) =>
  `${STALE_USER_DATA_PREFIX}: ${formatSyncContext(context)}`;

const getSyncFailureInfo = (error?: string) => {
  const message = error || '';
  const lower = message.toLowerCase();

  if (!message) {
    return {
      type: 'none',
      label: 'No error',
      detail: 'No sync error recorded',
      retryable: false,
    };
  }

  const columnMatch = message.match(/'([^']+)' column|column ['"]?([a-zA-Z0-9_]+)['"]?|Could not find the '([^']+)'/i);
  const column = columnMatch?.[1] || columnMatch?.[2] || columnMatch?.[3];

  if (lower.includes(STALE_USER_DATA_PREFIX)) {
    return {
      type: 'stale_user_data',
      label: 'Stale user/business data',
      detail: message,
      retryable: false,
    };
  }

  if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('42501')) {
    return {
      type: 'rls_violation',
      label: 'RLS violation',
      detail: message.includes('SyncContext:')
        ? message
        : 'Supabase rejected this row through row-level security. Repair Sync State refreshes the session and validates business ownership.',
      retryable: true,
    };
  }

  if (lower.includes('numeric field overflow') || lower.includes('precision') || lower.includes('22003')) {
    return {
      type: 'numeric_overflow',
      label: 'Numeric overflow',
      detail: 'A Supabase numeric column is too small for this value. Run the numeric precision migration, then retry.',
      retryable: true,
    };
  }

  if (lower.includes('could not find') || lower.includes('schema cache') || lower.includes('pgrst204') || lower.includes('column')) {
    return {
      type: 'schema_mismatch',
      label: 'Schema mismatch',
      detail: column
        ? `Supabase is missing or has not refreshed column "${column}". Run the schema parity migration and reload PostgREST schema cache.`
        : 'Supabase schema/cache does not match the local sync payload.',
      retryable: true,
    };
  }

  if (lower.includes('foreign key') || lower.includes('violates foreign key')) {
    return {
      type: 'reference_mismatch',
      label: 'Reference mismatch',
      detail: 'Supabase still expects remote UUID foreign keys, but the offline app syncs local IDs.',
      retryable: true,
    };
  }

  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('timeout')) {
    return {
      type: 'network',
      label: 'Network',
      detail: 'Network or Supabase connectivity failed during sync.',
      retryable: true,
    };
  }

  return {
    type: 'unknown',
    label: 'Sync error',
    detail: message,
    retryable: true,
  };
};

const serializeBusinessForSync = (payload: any) => ({
  ...serializeBase(payload),
  owner_id: payload.user_id,
  name: payload.business_name || payload.name,
  business_name: payload.business_name || payload.name,
  business_type: payload.business_type || payload.type,
  type: payload.type || payload.business_type,
  currency: payload.currency || 'NGN',
  address: payload.address || payload.physical_address || null,
  physical_address: payload.physical_address || payload.address || null,
});

const serializeLedgerEntryForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  source_type: payload.source_type,
  source_id: payload.source_id,
  debit_account: payload.debit_account,
  credit_account: payload.credit_account,
  amount: roundMoney(payload.amount) ?? 0,
  description: payload.description,
  is_correction: !!payload.is_correction,
  reversal_of_entry_id: payload.reversal_of_entry_id,
  correction_group_id: payload.correction_group_id,
  is_reversal: !!payload.is_reversal,
});

const serializeTransactionForSync = (payload: any) => ({
  ...serializeBase(payload),
  type: payload.type,
  amount: roundMoney(payload.amount) ?? 0,
  payment_method: payload.payment_method,
  status: payload.status,
  reference_id: payload.reference_id,
  customer_id: payload.customer_id,
  customer_name: payload.customer_name,
  category_id: payload.category_id,
  category_name: payload.category_name,
  display_title: payload.display_title,
  item_names: payload.item_names,
  service_name: payload.service_name,
  note: payload.note,
  is_reversed: !!payload.is_reversed,
  is_edited: !!payload.is_edited,
  reversal_reason: payload.reversal_reason,
  original_transaction_id: payload.original_transaction_id,
  source_type: payload.source_type,
  source_id: payload.source_id,
  correction_version: payload.correction_version,
  corrected_at: payload.corrected_at,
  original_payload: payload.original_payload,
});

const serializeServiceForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  name: payload.name,
  category_id: payload.category_id,
  category_name: payload.category_name,
  customer_id: payload.customer_id,
  amount: roundMoney(payload.amount) ?? 0,
  payment_method: payload.payment_method,
  status: payload.status,
  note: payload.note,
});

const serializeSaleForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  customer_id: payload.customer_id,
  total_amount: roundMoney(payload.total_amount) ?? 0,
  discount_amount: roundMoney(payload.discount_amount) ?? 0,
  tax_amount: roundMoney(payload.tax_amount) ?? 0,
  net_amount: roundMoney(payload.net_amount) ?? 0,
  payment_method: payload.payment_method,
  status: payload.status,
  note: payload.note,
});

const serializeSaleItemForSync = (payload: any) => ({
  ...serializeBase(payload),
  sale_id: payload.sale_id,
  product_id: payload.product_id,
  quantity: roundCost(payload.quantity) ?? 0,
  unit_price: roundMoney(payload.unit_price) ?? 0,
  total_price: roundMoney(payload.total_price) ?? 0,
  cost: roundCost(payload.cost) ?? 0,
});

const serializeExpenseForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  category_id: payload.category_id,
  category_name: payload.category_name,
  amount: roundMoney(payload.amount) ?? 0,
  payment_method: payload.payment_method,
  recipient: payload.recipient,
  note: payload.note,
  status: payload.status,
});

const serializeReceivableForSync = (payload: any) => ({
  ...serializeBase(payload),
  transaction_id: payload.transaction_id,
  customer_id: payload.customer_id,
  amount: roundMoney(payload.amount) ?? 0,
  paid_amount: roundMoney(payload.paid_amount) ?? 0,
  due_date: payload.due_date,
  status: payload.status,
});

const serializeInventoryMovementForSync = (payload: any) => ({
  ...serializeBase(payload),
  product_id: payload.product_id,
  type: payload.type,
  quantity: roundCost(payload.quantity) ?? 0,
  previous_stock: roundCost(payload.previous_stock) ?? 0,
  new_stock: roundCost(payload.new_stock) ?? 0,
  note: payload.note,
  reason: payload.reason,
  status: payload.status,
  unit_cost: roundCost(payload.unit_cost),
  total_cost: roundMoney(payload.total_cost),
});

const serializeProductForSync = (payload: any) => ({
  ...serializeBase(payload),
  name: payload.name,
  sku: payload.sku,
  barcode: payload.barcode,
  category_id: payload.category_id,
  unit_type: payload.unit_type,
  buying_price: roundMoney(payload.buying_price) ?? 0,
  selling_price: roundMoney(payload.selling_price) ?? 0,
  profit_margin: roundCost(payload.profit_margin),
  stock: roundCost(payload.stock) ?? 0,
  min_stock: roundCost(payload.min_stock) ?? 0,
  max_stock: roundCost(payload.max_stock),
  supplier_id: payload.supplier_id,
  expiry_date: payload.expiry_date,
  image_url: payload.image_url,
  notes: payload.notes,
  tags: payload.tags,
  is_archived: !!payload.is_archived,
  wac_price: roundCost(payload.wac_price),
});

const serializeServiceCategoryForSync = (payload: any) => ({
  ...serializeBase(payload),
  name: payload.name,
  description: payload.description,
  default_price: roundMoney(payload.default_price),
  status: payload.status,
});

const serializeExpenseCategoryForSync = (payload: any) => ({
  ...serializeBase(payload),
  name: payload.name,
  description: payload.description,
  default_amount: roundMoney(payload.default_amount),
  status: payload.status,
});

/**
 * Main Dispatcher: Strips all local-only or legacy fields.
 */
const serializeForSync = (entity: string, payload: any) => {
  switch (entity) {
    case 'businesses': return serializeBusinessForSync(payload);
    case 'ledger_entries': return serializeLedgerEntryForSync(payload);
    case 'transactions': return serializeTransactionForSync(payload);
    case 'sales': return serializeSaleForSync(payload);
    case 'sale_items': return serializeSaleItemForSync(payload);
    case 'expenses': return serializeExpenseForSync(payload);
    case 'services': return serializeServiceForSync(payload);
    case 'receivables': return serializeReceivableForSync(payload);
    case 'inventory_movements': return serializeInventoryMovementForSync(payload);
    case 'products': return serializeProductForSync(payload);
    case 'service_categories': return serializeServiceCategoryForSync(payload);
    case 'expense_categories': return serializeExpenseCategoryForSync(payload);
    default:
      return stripDexieId(payload);
  }
};

async function getCurrentSupabaseUser(refreshSession = false) {
  if (refreshSession) {
    try {
      await supabase.auth.refreshSession();
    } catch (error) {
      console.warn('[SyncService] Unable to refresh Supabase session:', error);
    }
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('[SyncService] Unable to read current Supabase user:', error.message);
  }
  return data.user || null;
}

async function fetchOwnedCloudBusinesses(userId: string) {
  const rows: any[] = [];

  const collect = async (field: 'owner_id' | 'user_id') => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq(field, userId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) return;
      rows.push(...(data || []));
    } catch {
      // Some schemas do not have user_id in cloud businesses; owner_id is canonical.
    }
  };

  await collect('owner_id');
  await collect('user_id');

  return Array.from(
    new Map(rows.map((row) => [row.local_id || row.business_id || row.id, row])).values()
  );
}

async function fetchOwnedCloudBusiness(userId: string, businessId: string) {
  const businesses = await fetchOwnedCloudBusinesses(userId);
  return businesses.find((business) => (
    business.local_id === businessId ||
    business.business_id === businessId ||
    business.id === businessId
  )) || null;
}

function normalizeRemoteBusiness(raw: any, userId: string) {
  const businessId = raw?.business_id || raw?.local_id || raw?.id;
  if (!businessId) return null;

  const name = raw?.business_name || raw?.name || 'Kola Business';
  const type = raw?.business_type || raw?.type || 'retail';
  const address = raw?.physical_address || raw?.address || '';

  return {
    local_id: raw?.local_id || businessId,
    business_id: businessId,
    user_id: raw?.owner_id || raw?.user_id || userId,
    business_name: name,
    business_type: type,
    name,
    type,
    currency: raw?.currency || 'NGN',
    address,
    physical_address: address,
    created_at: raw?.created_at ? new Date(raw.created_at) : new Date(),
    updated_at: raw?.updated_at ? new Date(raw.updated_at) : new Date(),
    sync_status: 'synced' as const,
    version: raw?.version || 1,
    device_id: raw?.device_id || 'web-pwa',
  };
}

async function saveRemoteBusinessLocally(raw: any, userId: string) {
  const business = normalizeRemoteBusiness(raw, userId);
  if (!business) return null;

  const existing = await db.businesses.where('business_id').equals(business.business_id).first();
  if (existing?.id) {
    await db.businesses.update(existing.id, business);
  } else {
    await db.businesses.add(business);
  }

  useAuthStore.getState().updateBusiness({
    id: business.business_id,
    local_id: business.local_id,
    business_id: business.business_id,
    user_id: business.user_id,
    name: business.name,
    type: business.type,
    business_name: business.business_name,
    business_type: business.business_type,
    currency: business.currency,
    address: business.address,
    physical_address: business.physical_address,
    sync_status: 'synced',
  });

  return business;
}

async function clearLocalBusinessScopedData(business_id: string) {
  const tableNames = [
    'businesses',
    'products',
    'categories',
    'service_categories',
    'expense_categories',
    'transactions',
    'sales',
    'sale_items',
    'services',
    'expenses',
    'ledger_entries',
    'inventory_movements',
    'customers',
    'suppliers',
    'receivables',
    'app_settings',
    'receipts',
    'audit_logs',
  ];

  for (const tableName of tableNames) {
    const table = (db as any)[tableName];
    if (!table) continue;
    await table.where('business_id').equals(business_id).delete();
  }
}



export const syncService = {
  isProcessing: false,
  isFullSyncing: false,
  fullSyncStartedAt: null as number | null,

  async pauseSyncForAuthFailure(business_id?: string, error = SESSION_EXPIRED_MESSAGE) {
    if (business_id) {
      requestedSyncBusinesses.delete(business_id);
      const existingTimer = requestedSyncTimers.get(business_id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        requestedSyncTimers.delete(business_id);
      }
      await this.updateMetadata(business_id, 'last_sync_status', 'auth_required');
      await this.updateMetadata(business_id, 'last_sync_error', error);
    }

    clearSyncLock();
    clearGhostAuthState(error);
  },

  async ensureSyncPreflight(source: string, business_id?: string) {
    const result = await ensureSupabaseSession(source);
    if (result.ok) return result;

    await this.pauseSyncForAuthFailure(business_id, result.error || SESSION_EXPIRED_MESSAGE);
    return null;
  },

  requestImmediateSync(business_id: string) {
    if (!business_id) return false;

    if (!onlineStatusService.getOnlineStatus()) {
      this.recoverStaleSyncState(business_id).catch((error) => {
        console.warn('[SyncService] Offline stale sync recovery failed:', error);
      });
      return false;
    }

    requestedSyncBusinesses.add(business_id);
    const requestedAt = new Date().toISOString();
    this.updateMetadata(business_id, 'last_sync_attempt_at', requestedAt).catch(() => {});
    this.updateMetadata(business_id, 'last_sync_status', 'pending').catch(() => {});
    this.scheduleRequestedSync(business_id);
    return true;
  },

  scheduleRequestedSync(business_id: string, delay = 0) {
    if (!business_id) return;

    const existing = requestedSyncTimers.get(business_id);
    if (existing) {
      if (delay > 0) return;
      clearTimeout(existing);
      requestedSyncTimers.delete(business_id);
    }

    const timer = setTimeout(() => {
      requestedSyncTimers.delete(business_id);
      this.runRequestedSyncIfNeeded(business_id).catch((error) => {
        console.warn('[SyncService] Requested background sync failed:', error);
      });
    }, delay);

    requestedSyncTimers.set(business_id, timer);
  },

  async runRequestedSyncIfNeeded(business_id: string) {
    if (!business_id || !requestedSyncBusinesses.has(business_id)) return false;
    if (!onlineStatusService.getOnlineStatus()) return false;

    if (this.isProcessing || this.isFullSyncing) {
      this.scheduleRequestedSync(business_id, LOCKED_SYNC_RETRY_MS);
      return false;
    }

    const pendingCount = await db.sync_queue
      .where('business_id')
      .equals(business_id)
      .filter((item) => item.status === 'pending')
      .count();

    if (pendingCount === 0) {
      requestedSyncBusinesses.delete(business_id);
      return false;
    }

    requestedSyncBusinesses.delete(business_id);
    return this.runFullSync(business_id);
  },

  async updateMetadata(business_id: string, key: string, value: any) {
    const matches = await db.app_settings
      .where('[business_id+key]')
      .equals([business_id, key])
      .toArray();
    const [existing, ...duplicates] = matches.sort((a, b) => {
      const left = safeTime(a.updated_at);
      const right = safeTime(b.updated_at);
      return right - left;
    });

    if (existing) {
      await db.app_settings.update(existing.id!, { value, updated_at: new Date() });
    } else {
      await db.app_settings.add({ business_id, key, value, updated_at: new Date() });
    }

    if (duplicates.length > 0) {
      await db.app_settings.bulkDelete(duplicates.map((setting) => setting.id!).filter(Boolean));
    }
  },

  getActiveBusinessId() {
    const authState = useAuthStore.getState();
    return authState.activeBusinessId || authState.business?.business_id || authState.business?.id || null;
  },

  async markQueueItemBlocked(item: SyncQueue, context: SyncPreflightContext) {
    if (item.id === undefined) return;

    await db.sync_queue.update(item.id, {
      status: 'failed',
      retry_count: MAX_RETRIES,
      error: buildStaleUserDataError(context),
      sync_started_at: null,
      sync_lock_owner: null,
      last_sync_heartbeat_at: null,
    });

    if (item.business_id) {
      await this.updateMetadata(item.business_id, 'last_sync_status', 'failed');
      await this.updateMetadata(item.business_id, 'last_sync_error', buildStaleUserDataError(context));
    }
  },

  async validateQueueItemOwnership(item: SyncQueue): Promise<SyncPreflightContext> {
    const user = await getCurrentSupabaseUser();
    const activeBusinessId = this.getActiveBusinessId();
    const context: SyncPreflightContext = {
      currentUserId: user?.id || null,
      activeBusinessId,
      queueBusinessId: item.business_id || null,
      entity: item.entity,
      ownershipMismatch: false,
    };

    if (!user?.id) {
      return { ...context, ownershipMismatch: true, reason: 'No current Supabase user session' };
    }

    if (!activeBusinessId) {
      return { ...context, ownershipMismatch: true, reason: 'Missing active business in auth store' };
    }

    if (item.business_id !== activeBusinessId) {
      return { ...context, ownershipMismatch: true, reason: 'Queue item business does not match active business' };
    }

    const localBusiness = await db.businesses.where('business_id').equals(activeBusinessId).first();
    const localBusinessUserId = (localBusiness as any)?.user_id || (localBusiness as any)?.owner_id || null;
    context.localBusinessUserId = localBusinessUserId;

    if (!localBusiness) {
      return { ...context, ownershipMismatch: true, reason: 'Active business is missing from local Dexie' };
    }

    if (!localBusinessUserId) {
      return { ...context, ownershipMismatch: true, reason: 'Local business owner is missing and cannot be validated' };
    }

    if (localBusinessUserId !== user.id) {
      return { ...context, ownershipMismatch: true, reason: 'Local business owner does not match current Supabase user' };
    }

    const payloadOwnerId = item.entity === 'businesses'
      ? (item.payload?.user_id || item.payload?.owner_id || null)
      : null;

    if (payloadOwnerId && payloadOwnerId !== user.id) {
      return { ...context, ownershipMismatch: true, reason: 'Business queue payload owner does not match current Supabase user' };
    }

    const cloudBusiness = await fetchOwnedCloudBusiness(user.id, activeBusinessId);
    context.cloudBusinessOwnerId = cloudBusiness?.owner_id || cloudBusiness?.user_id || null;

    if (!cloudBusiness && item.entity !== 'businesses') {
      return { ...context, ownershipMismatch: true, reason: 'Active business is not owned by current Supabase user in cloud' };
    }

    return context;
  },

  async getQueueDiagnostics(business_id: string) {
    await this.recoverStaleSyncState(business_id);
    return this.readQueueDiagnostics(business_id);
  },

  /**
   * Read-only diagnostics — safe to call inside useLiveQuery / liveQuery.
   * Does NOT perform any write operations (no stale recovery).
   */
  async readQueueDiagnostics(business_id: string) {
    const queue = await db.sync_queue
      .where('business_id')
      .equals(business_id)
      .toArray();

    const pendingItems = queue.filter((item) => item.status === 'pending');
    const syncingItems = queue.filter((item) => item.status === 'syncing');
    const failedItems = queue.filter((item) => item.status === 'failed');
    const firstProblem = failedItems[0] || syncingItems[0] || pendingItems[0] || null;
    const lock = readSyncLock();

    return {
      pendingCount: pendingItems.length,
      syncingCount: syncingItems.length,
      failedCount: failedItems.length,
      firstProblem,
      lock: lock ? {
        ...lock,
        ageMs: getLockAge(lock),
        stale: isStaleLock(lock),
        ownedByThisInstance: isBrowser() ? lock.owner === getInstanceId() : true,
      } : null,
      items: queue
        .sort((a, b) => {
          const left = safeTime(a.created_at);
          const right = safeTime(b.created_at);
          return left - right;
        })
        .map((item) => ({
          ...item,
          failure: getSyncFailureInfo(item.error),
          retryEligible: item.status === 'failed' && getSyncFailureInfo(item.error).retryable,
        })),
    };
  },


  async retryFailed(business_id: string) {
    return this.retryFailedQueueItems(business_id);
  },

  async retryFailedQueueItems(business_id: string) {
    const failedItems = await db.sync_queue
      .where('business_id')
      .equals(business_id)
      .filter((item) => item.status === 'failed')
      .toArray();

    const retryableItems = failedItems.filter((item) => getSyncFailureInfo(item.error).retryable && item.id !== undefined);
    if (retryableItems.length === 0) return 0;

    await db.sync_queue.bulkUpdate(retryableItems.map((item) => ({
      key: item.id!,
      changes: {
        status: 'pending',
        retry_count: 0,
        error: undefined,
        sync_started_at: null,
        sync_lock_owner: null,
        last_sync_heartbeat_at: null,
      },
    })));

    return retryableItems.length;
  },

  async retrySingleItem(id: number) {
    const item = await db.sync_queue.get(id);
    if (!item || item.status !== 'failed') {
      throw new Error('Only failed sync items can be retried');
    }

    const failure = getSyncFailureInfo(item.error);
    if (!failure.retryable) {
      throw new Error('This sync item is not retryable');
    }

    await db.sync_queue.update(id, {
      status: 'pending',
      retry_count: 0,
      error: undefined,
      sync_started_at: null,
      sync_lock_owner: null,
      last_sync_heartbeat_at: null,
    });
  },

  async recoverStaleSyncState(business_id?: string) {
    const lock = readSyncLock();
    if (isStaleLock(lock)) {
      clearSyncLock();
    }

    const cutoff = Date.now() - STALE_SYNC_MS;
    const staleItems = (await db.sync_queue.where('status').equals('syncing').toArray())
      .filter((item) => {
        if (business_id && item.business_id !== business_id) return false;
        const heartbeat = item.last_sync_heartbeat_at || item.sync_started_at;
        if (!heartbeat) return true;
        return safeTime(heartbeat) < cutoff;
      });

    if (staleItems.length > 0) {
      await db.sync_queue.bulkUpdate(staleItems
        .filter((item) => item.id !== undefined)
        .map((item) => ({
          key: item.id!,
          changes: {
            status: 'pending',
            error: 'Recovered stale syncing item from an interrupted sync run',
            sync_started_at: null,
            sync_lock_owner: null,
            last_sync_heartbeat_at: null,
          },
        })));
    }

    if (business_id) {
      const pendingCount = await db.sync_queue.where('business_id').equals(business_id).filter((item) => item.status === 'pending').count();
      const syncingCount = await db.sync_queue.where('business_id').equals(business_id).filter((item) => item.status === 'syncing').count();
      const failedCount = await db.sync_queue.where('business_id').equals(business_id).filter((item) => item.status === 'failed').count();
      await this.updateMetadata(business_id, 'sync_lock_owner', readSyncLock()?.owner || null);
      await this.updateMetadata(
        business_id,
        'last_sync_status',
        syncingCount > 0 ? 'syncing' : pendingCount > 0 ? 'pending' : failedCount > 0 ? 'failed' : 'synced',
      );
    }
  },

  async repairSyncState(business_id?: string, options: { runSync?: boolean; reason?: string } = {}) {
    if (!onlineStatusService.getOnlineStatus()) {
      throw new Error('Repair requires an internet connection.');
    }

    const session = await this.ensureSyncPreflight('sync-repair', business_id || this.getActiveBusinessId() || undefined);
    const user = session?.user;
    if (!user?.id) {
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }

    const activeBusinessId = business_id || this.getActiveBusinessId();
    if (!activeBusinessId) {
      throw new Error('Repair failed: no active business is selected.');
    }

    clearSyncLock();
    await this.updateMetadata(activeBusinessId, 'last_sync_status', 'repairing');
    await this.updateMetadata(activeBusinessId, 'last_sync_repair_started_at', new Date().toISOString());

    const localBusiness = await db.businesses.where('business_id').equals(activeBusinessId).first();
    const localBusinessUserId = (localBusiness as any)?.user_id || (localBusiness as any)?.owner_id || null;
    const cloudBusiness = await fetchOwnedCloudBusiness(user.id, activeBusinessId);
    const ownershipMismatch = !localBusinessUserId || localBusinessUserId !== user.id;

    let quarantinedCount = 0;
    const allQueueItems = await db.sync_queue.toArray();
    const staleItems = allQueueItems.filter((item) => (
      item.business_id !== activeBusinessId ||
      ownershipMismatch ||
      (item.entity === 'businesses' && item.payload && (item.payload.user_id || item.payload.owner_id) && (item.payload.user_id || item.payload.owner_id) !== user.id)
    ));

    for (const item of staleItems) {
      await this.markQueueItemBlocked(item, {
        currentUserId: user.id,
        activeBusinessId,
        queueBusinessId: item.business_id || null,
        entity: item.entity,
        ownershipMismatch: true,
        localBusinessUserId,
        cloudBusinessOwnerId: cloudBusiness?.owner_id || cloudBusiness?.user_id || null,
        reason: item.business_id !== activeBusinessId
          ? 'Queue item belongs to a different business than the active business'
          : 'Queue item belongs to a stale or mismatched user/business state',
      });
      quarantinedCount += 1;
    }

    if (ownershipMismatch && cloudBusiness) {
      await clearLocalBusinessScopedData(activeBusinessId);
    }

    if (cloudBusiness) {
      await saveRemoteBusinessLocally(cloudBusiness, user.id);
      await this.pullFromCloudBatched(activeBusinessId);
    } else if (ownershipMismatch) {
      await this.updateMetadata(
        activeBusinessId,
        'last_sync_error',
        buildStaleUserDataError({
          currentUserId: user.id,
          activeBusinessId,
          queueBusinessId: activeBusinessId,
          entity: 'businesses',
          ownershipMismatch: true,
          localBusinessUserId,
          cloudBusinessOwnerId: null,
          reason: 'Active business is not owned by current Supabase user in cloud',
        }),
      );
    }

    await this.recoverStaleSyncState(activeBusinessId);
    const retriedCount = await this.retryFailedQueueItems(activeBusinessId);

    if (options.runSync) {
      requestedSyncBusinesses.delete(activeBusinessId);
      await this.runFullSync(activeBusinessId);
    }

    await this.updateMetadata(activeBusinessId, 'last_sync_repair_completed_at', new Date().toISOString());
    await this.updateMetadata(activeBusinessId, 'last_sync_repair_summary', {
      reason: options.reason || 'manual',
      currentUserId: user.id,
      activeBusinessId,
      localBusinessUserId,
      cloudBusinessOwnerId: cloudBusiness?.owner_id || cloudBusiness?.user_id || null,
      ownershipMismatch,
      quarantinedCount,
      retriedCount,
    });

    return {
      currentUserId: user.id,
      activeBusinessId,
      localBusinessUserId,
      cloudBusinessOwnerId: cloudBusiness?.owner_id || cloudBusiness?.user_id || null,
      ownershipMismatch,
      quarantinedCount,
      retriedCount,
      pulledFreshCloudData: !!cloudBusiness,
    };
  },

  async maybeSelfHealRlsFailures(business_id: string) {
    if (autoHealedRlsBusinesses.has(business_id)) return false;

    const failedItems = await db.sync_queue
      .where('business_id')
      .equals(business_id)
      .filter((item) => item.status === 'failed' && getSyncFailureInfo(item.error).type === 'rls_violation')
      .toArray();

    if (failedItems.length < RLS_SELF_HEAL_THRESHOLD) return false;

    autoHealedRlsBusinesses.add(business_id);
    await this.updateMetadata(business_id, 'last_sync_status', 'repairing');
    await this.updateMetadata(business_id, 'last_sync_error', `Detected ${failedItems.length} RLS sync failures. Refreshing auth and validating business ownership.`);

    try {
      await this.repairSyncState(business_id, { runSync: false, reason: 'auto-rls-failure' });
      await db.sync_queue.bulkUpdate(failedItems
        .filter((item) => item.id !== undefined && getSyncFailureInfo(item.error).retryable)
        .map((item) => ({
          key: item.id!,
          changes: {
            status: 'pending',
            retry_count: 0,
            error: undefined,
            sync_started_at: null,
            sync_lock_owner: null,
            last_sync_heartbeat_at: null,
          },
        })));
      return true;
    } catch (error: any) {
      await this.updateMetadata(business_id, 'last_sync_status', 'failed');
      await this.updateMetadata(business_id, 'last_sync_error', error.message || 'RLS self-heal failed');
      return false;
    }
  },

  async clearFailedItem(id: number) {
    const item = await db.sync_queue.get(id);
    if (!item || item.status !== 'failed') {
      throw new Error('Only failed sync items can be cleared');
    }
    await db.sync_queue.delete(id);
  },

  async processQueue(business_id?: string, lockAlreadyHeld = false) {
    if (!onlineStatusService.getOnlineStatus()) return false;
    if (this.isProcessing) {
      if (business_id) requestedSyncBusinesses.add(business_id);
      return false;
    }

    let activeBusinessId = business_id;
    let lockOwner: string | null = null;
    let lockAcquiredHere = false;

    try {
      const firstItem = business_id
        ? await db.sync_queue.where('business_id').equals(business_id).first()
        : await db.sync_queue.limit(1).first();
      activeBusinessId = business_id || firstItem?.business_id;
      if (!activeBusinessId) return false;

      const session = await this.ensureSyncPreflight('sync-preflight', activeBusinessId);
      if (!session) return false;

      await this.recoverStaleSyncState(activeBusinessId);

      if (!lockAlreadyHeld) {
        const lock = acquireSyncLock(activeBusinessId);
        if (!lock.acquired) {
          requestedSyncBusinesses.add(activeBusinessId);
          this.scheduleRequestedSync(activeBusinessId, LOCKED_SYNC_RETRY_MS);
          return false;
        }
        lockOwner = lock.owner;
        lockAcquiredHere = true;
      } else {
        lockOwner = readSyncLock()?.owner || getInstanceId();
      }

      this.isProcessing = true;

      // Auto-recovery for businesses schema mismatch
      await db.sync_queue
        .where('entity').equals('businesses')
        .and(item => !!(item.status === 'failed' && (item.error?.includes('business_name') || item.error?.includes('PGRST204'))))
        .modify({
          status: 'pending',
          retry_count: 0,
          error: undefined,
          sync_started_at: null,
          sync_lock_owner: null,
          last_sync_heartbeat_at: null,
        });

      const startedAt = new Date().toISOString();
      await this.updateMetadata(activeBusinessId, 'last_sync_attempt_at', startedAt);
      await this.updateMetadata(activeBusinessId, 'sync_started_at', startedAt);
      await this.updateMetadata(activeBusinessId, 'sync_lock_owner', lockOwner);
      await this.updateMetadata(activeBusinessId, 'last_sync_status', 'syncing');
      await heartbeatSyncLock(activeBusinessId, lockOwner || getInstanceId());

      // Fetch more than BATCH_SIZE so we can sort them and still have a good batch
      let items = await db.sync_queue.where('status').equals('pending').limit(100).toArray();
      if (activeBusinessId) {
        items = items.filter((item) => item.business_id === activeBusinessId);
      }

      if (items.length === 0) {
        if (activeBusinessId) {
          const failedCount = await db.sync_queue.where('business_id').equals(activeBusinessId).filter((item) => item.status === 'failed').count();
          await this.updateMetadata(activeBusinessId, 'last_sync_status', failedCount > 0 ? 'failed' : 'synced');
          if (failedCount === 0) {
            await this.updateMetadata(activeBusinessId, 'last_successful_sync_at', new Date().toISOString());
          }
        }
        return;
      }

      // Sort by priority first, then by creation date
      const sortedItems = items.sort((a, b) => {
        const priorityA = ENTITY_PRIORITY[a.entity] || 99;
        const priorityB = ENTITY_PRIORITY[b.entity] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        const dateA = safeTime(a.created_at);
        const dateB = safeTime(b.created_at);
        return dateA - dateB;
      });

      // Take only the first BATCH_SIZE after sorting
      const batch = sortedItems.slice(0, BATCH_SIZE);

      for (const item of batch) {
        await heartbeatSyncLock(activeBusinessId, lockOwner || getInstanceId());
        await this.syncItem(item);
      }
      await this.updateMetadata(activeBusinessId, 'last_push_at', new Date().toISOString());
      await this.maybeSelfHealRlsFailures(activeBusinessId);

      const remainingPending = await db.sync_queue
        .where('status')
        .equals('pending')
        .filter((item) => !activeBusinessId || item.business_id === activeBusinessId)
        .count();
      const failedCount = await db.sync_queue
        .where('status')
        .equals('failed')
        .filter((item) => !activeBusinessId || item.business_id === activeBusinessId)
        .count();

      if (remainingPending > 0) {
        if (activeBusinessId) {
          await this.updateMetadata(activeBusinessId, 'last_sync_status', 'pending');
        }
      } else if (activeBusinessId) {
        await this.updateMetadata(activeBusinessId, 'last_sync_status', failedCount > 0 ? 'failed' : 'synced');
        if (failedCount === 0) {
          await this.updateMetadata(activeBusinessId, 'last_successful_sync_at', new Date().toISOString());
        }
      }
    } catch (error: any) {
      console.error('[SyncService] Error processing queue:', error);
      if (activeBusinessId) {
        await this.updateMetadata(activeBusinessId, 'last_sync_status', 'failed');
        await this.updateMetadata(activeBusinessId, 'last_sync_error', error.message || 'Unknown error');
      }
    } finally {
      this.isProcessing = false;
      if (lockAcquiredHere) clearSyncLock(lockOwner || undefined);
      if (activeBusinessId && requestedSyncBusinesses.has(activeBusinessId)) {
        this.scheduleRequestedSync(activeBusinessId);
      }
    }
    return true;
  },

  async syncItem(item: SyncQueue) {
    const { entity, action, payload, id, retry_count } = item;
    let preflightContext: SyncPreflightContext | null = null;
    
    try {
      if (!item.business_id || !entity || !action || !payload || !item.entity_id) {
        throw new Error('Invalid sync queue item');
      }

      const localTable = syncTables[entity as keyof typeof syncTables] as any;
      if (!localTable) {
        throw new Error(`Unsupported sync entity: ${entity}`);
      }

      preflightContext = await this.validateQueueItemOwnership(item);
      if (preflightContext.ownershipMismatch) {
        if (preflightContext.reason === 'No current Supabase user session') {
          await this.pauseSyncForAuthFailure(item.business_id, SESSION_EXPIRED_MESSAGE);
          return;
        }
        await this.markQueueItemBlocked(item, preflightContext);
        return;
      }

      const lock = readSyncLock();
      const syncTime = new Date().toISOString();
      await db.sync_queue.update(id!, {
        status: 'syncing',
        sync_started_at: syncTime,
        sync_lock_owner: lock?.owner || getInstanceId(),
        last_sync_heartbeat_at: syncTime,
      });

      let result;
      switch (action) {
        case 'create':
        case 'update':
          const syncPayload = serializeForSync(entity, payload);
          result = await supabase.from(entity).upsert(syncPayload, { onConflict: 'local_id' });
          break;

        case 'delete':
          result = await supabase.from(entity).delete().eq('local_id', item.entity_id);
          break;
      }

      if (result?.error) {
        const details = [
          result.error.message,
          result.error.details,
          result.error.hint,
          result.error.code,
        ].filter(Boolean).join(' | ');
        const context = preflightContext ? ` | SyncContext: ${formatSyncContext(preflightContext)}` : '';
        throw new Error(`${details || 'Supabase sync failed'}${context}`);
      }

      // Success: Remove from queue and mark local as synced
      await db.sync_queue.delete(id!);
      
      const localItem = await localTable.where('local_id').equals(item.entity_id).first();
      if (localItem) {
        await localTable.update(localItem.id, { sync_status: 'synced', updated_at: new Date() });
      }

    } catch (error: any) {

      const failure = getSyncFailureInfo(error.message || error.details);
      const newRetryCount = (retry_count || 0) + 1;
      const status = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending';
      await db.sync_queue.update(id!, { 
        status: failure.type === 'stale_user_data' ? 'failed' : status,
        retry_count: failure.type === 'stale_user_data' ? MAX_RETRIES : newRetryCount,
        error: error.message || error.details || 'Unknown error',
        sync_started_at: null,
        sync_lock_owner: null,
        last_sync_heartbeat_at: null,
      });
    }
  },

  async pullFromCloud(business_id: string) {
    if (!onlineStatusService.getOnlineStatus()) return;
    const session = await this.ensureSyncPreflight('sync-preflight', business_id);
    if (!session) return false;

    const tables = Object.keys(ENTITY_PRIORITY).sort((a, b) => ENTITY_PRIORITY[a] - ENTITY_PRIORITY[b]);

    for (const table of tables) {
      // Get last sync time for this table
      const syncKey = `last_sync_${table}`;
      const lastSyncSetting = await db.app_settings
        .where('business_id')
        .equals(business_id)
        .filter((setting) => setting.key === syncKey)
        .first();
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
          const localTable = syncTables[table as keyof typeof syncTables] as any;
          if (!localTable) continue;
          const { id: _remoteId, ...remoteWithoutId } = remoteItem as any;

          const localItem = await localTable.where('local_id').equals((remoteItem as any).local_id).first();

          
          // Convert string dates to Date objects for Dexie
          const processedItem: any = {
            ...remoteWithoutId,
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
    await this.updateMetadata(business_id, 'last_pull_at', new Date().toISOString());
  },

  /**
   * Batch-optimized pull for initial hydration after login/user-switch.
   * Fetches ALL tables from Supabase first, then writes everything into Dexie
   * in a single transaction. This prevents the "drip-feed" effect where
   * dashboard items appear one by one.
   *
   * Falls back gracefully on timeout (10s) or network errors.
   */
  async pullFromCloudBatched(business_id: string): Promise<boolean> {
    if (!onlineStatusService.getOnlineStatus()) return false;
    const session = await this.ensureSyncPreflight('sync-preflight', business_id);
    if (!session) return false;

    const tables = Object.keys(ENTITY_PRIORITY).sort(
      (a, b) => ENTITY_PRIORITY[a] - ENTITY_PRIORITY[b]
    );

    // Phase 1: Fetch all data from Supabase (network-bound)
    const allData: Record<string, any[]> = {};
    const syncTimestamps: Record<string, string> = {};

    const fetchPromises = tables.map(async (table) => {
      try {
        const syncKey = `last_sync_${table}`;
        const lastSyncSetting = await db.app_settings
          .where('business_id')
          .equals(business_id)
          .filter((setting) => setting.key === syncKey)
          .first();
        const lastSyncTime = lastSyncSetting?.value || new Date(0).toISOString();

        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('business_id', business_id)
          .gt('updated_at', lastSyncTime)
          .order('updated_at', { ascending: true })
          .limit(500);

        if (error) {
          console.warn(`[SyncService] Batch pull: Error fetching ${table}:`, error.message);
          return;
        }

        if (data && data.length > 0) {
          allData[table] = data;
          syncTimestamps[table] = (data[data.length - 1] as any).updated_at;
        }
      } catch (err) {
        console.warn(`[SyncService] Batch pull: Failed to fetch ${table}:`, err);
      }
    });

    // Fetch all tables in parallel with a 10-second overall timeout
    try {
      await Promise.race([
        Promise.all(fetchPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Initial sync timeout')), 10000)
        ),
      ]);
    } catch (err: any) {
      console.warn('[SyncService] Batch pull timed out, using partial data:', err.message);
    }

    // Phase 2: Write all fetched data into Dexie in a single transaction
    const tablesWithData = Object.keys(allData);
    if (tablesWithData.length === 0) {
      await this.updateMetadata(business_id, 'last_pull_at', new Date().toISOString());
      return true;
    }

    try {
      // Collect Dexie table references for the transaction scope
      const txTables: any[] = tablesWithData
        .map((t) => (syncTables as any)[t])
        .filter(Boolean);
      txTables.push(db.app_settings);

      await db.transaction('rw', txTables, async () => {
          for (const table of tablesWithData) {
            const localTable = (syncTables as any)[table];
            if (!localTable) continue;

            const items = allData[table];

            for (const remoteItem of items) {
              const { id: _remoteId, ...remoteWithoutId } = remoteItem as any;

              const processedItem: any = {
                ...remoteWithoutId,
                created_at: remoteItem.created_at ? new Date(remoteItem.created_at) : new Date(),
                updated_at: remoteItem.updated_at ? new Date(remoteItem.updated_at) : new Date(),
                deleted_at: remoteItem.deleted_at ? new Date(remoteItem.deleted_at) : null,
                sync_status: 'synced',
              };

              const localItem = await localTable
                .where('local_id')
                .equals(remoteItem.local_id)
                .first();

              if (localItem) {
                if (localItem.sync_status === 'pending' || localItem.sync_status === 'failed') {
                  await conflictResolver.resolve(table, localItem, processedItem);
                } else {
                  await localTable.update(localItem.id, processedItem);
                }
              } else {
                await localTable.add(processedItem);
              }
            }

            // Update sync timestamp for this table
            if (syncTimestamps[table]) {
              const syncKey = `last_sync_${table}`;
              const existing = await db.app_settings
                .where('business_id')
                .equals(business_id)
                .filter((s: any) => s.key === syncKey)
                .first();

              if (existing) {
                await db.app_settings.update(existing.id!, {
                  value: syncTimestamps[table],
                  updated_at: new Date(),
                });
              } else {
                await db.app_settings.add({
                  business_id,
                  key: syncKey,
                  value: syncTimestamps[table],
                  updated_at: new Date(),
                });
              }
            }
          }
        }
      );
    } catch (err) {
      console.error('[SyncService] Batch pull: Dexie transaction failed:', err);
      // Fall back to individual writes if transaction fails
      await this.pullFromCloud(business_id);
    }

    await this.updateMetadata(business_id, 'last_pull_at', new Date().toISOString());
    return true;
  },

  async pullLatestFromCloud(business_id: string) {
    if (!onlineStatusService.getOnlineStatus()) return false;
    if (this.isProcessing || this.isFullSyncing) return false;
    const session = await this.ensureSyncPreflight('sync-preflight', business_id);
    if (!session) return false;

    await this.recoverStaleSyncState(business_id);
    const lock = acquireSyncLock(business_id);
    if (!lock.acquired) return false;

    this.isProcessing = true;
    try {
      await this.updateMetadata(business_id, 'last_sync_status', 'pulling');
      await heartbeatSyncLock(business_id, lock.owner);
      await this.pullFromCloud(business_id);
      await this.updateMetadata(business_id, 'last_sync_status', 'synced');
      return true;
    } catch (error: any) {
      await this.updateMetadata(business_id, 'last_sync_status', 'failed');
      await this.updateMetadata(business_id, 'last_sync_error', error.message || 'Unknown error');
      return false;
    } finally {
      this.isProcessing = false;
      clearSyncLock(lock.owner);
    }
  },

  async runFullSync(business_id: string) {
    if (!onlineStatusService.getOnlineStatus()) {
      await this.recoverStaleSyncState(business_id);
      return false;
    }

    const session = await this.ensureSyncPreflight('sync-preflight', business_id);
    if (!session) return false;

    if (this.isFullSyncing) {
      if (this.fullSyncStartedAt && Date.now() - this.fullSyncStartedAt > STALE_SYNC_MS) {
        this.isFullSyncing = false;
        this.fullSyncStartedAt = null;
      } else {
        requestedSyncBusinesses.add(business_id);
        return false;
      }
    }

    await this.recoverStaleSyncState(business_id);
    if (!autoRetriedBusinesses.has(business_id)) {
      const retriedCount = await this.retryFailedQueueItems(business_id);
      if (retriedCount > 0) {
        console.info(`[SyncService] Retrying ${retriedCount} recoverable failed sync item(s) after schema/RLS recovery.`);
      }
      autoRetriedBusinesses.add(business_id);
    }

    const lock = acquireSyncLock(business_id);
    if (!lock.acquired) {
      await this.updateMetadata(business_id, 'sync_lock_owner', lock.owner);
      requestedSyncBusinesses.add(business_id);
      this.scheduleRequestedSync(business_id, LOCKED_SYNC_RETRY_MS);
      return false;
    }

    this.isFullSyncing = true;
    this.fullSyncStartedAt = Date.now();

    try {
      const startedAt = new Date().toISOString();
      await this.updateMetadata(business_id, 'last_sync_attempt_at', startedAt);
      await this.updateMetadata(business_id, 'sync_started_at', startedAt);
      await this.updateMetadata(business_id, 'sync_lock_owner', lock.owner);
      await this.updateMetadata(business_id, 'last_sync_status', 'syncing');
      await heartbeatSyncLock(business_id, lock.owner);

      await this.processQueue(business_id, true);
      await heartbeatSyncLock(business_id, lock.owner);
      await this.pullFromCloud(business_id);

      const pendingCount = await db.sync_queue
        .where('business_id')
        .equals(business_id)
        .filter((item) => item.status === 'pending' || item.status === 'syncing')
        .count();
      const failedCount = await db.sync_queue
        .where('business_id')
        .equals(business_id)
        .filter((item) => item.status === 'failed')
        .count();

      if (pendingCount > 0) {
        requestedSyncBusinesses.add(business_id);
        await this.updateMetadata(business_id, 'last_sync_status', 'pending');
        return false;
      }

      if (failedCount > 0) {
        await this.updateMetadata(business_id, 'last_sync_status', 'failed');
        return false;
      }

      await this.updateMetadata(business_id, 'last_successful_sync_at', new Date().toISOString());
      await this.updateMetadata(business_id, 'last_sync_status', 'synced');
      await this.updateMetadata(business_id, 'last_sync_error', null);
      return true;
    } catch (error: any) {
      await this.updateMetadata(business_id, 'last_sync_status', 'failed');
      await this.updateMetadata(business_id, 'last_sync_error', error.message || 'Unknown error');
      throw error;
    } finally {
      this.isFullSyncing = false;
      this.fullSyncStartedAt = null;
      clearSyncLock(lock.owner);
      if (requestedSyncBusinesses.has(business_id)) {
        this.scheduleRequestedSync(business_id);
      }
    }
  }

};
