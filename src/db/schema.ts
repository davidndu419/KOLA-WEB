// src/db/schema.ts

export interface BaseEntity {
  id?: number;
  localId: string;
  businessId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  syncStatus: 'pending' | 'synced' | 'failed' | 'conflict';
  version: number;
  deviceId: string;
}

export interface Product extends BaseEntity {
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  unitType: 'piece' | 'kg' | 'liter' | 'pack' | 'set';
  buyingPrice: number;
  sellingPrice: number;
  profitMargin: number;
  stock: number;
  minStock: number;
  maxStock?: number;
  supplier?: string;
  expiryDate?: Date | null;
  image?: string;
  notes?: string;
  tags?: string[];
  isArchived: boolean;
}

export interface Category extends BaseEntity {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface InventoryMovement extends BaseEntity {
  productId: string;
  type: 'stock-in' | 'stock-out' | 'adjustment' | 'damage' | 'return';
  quantity: number;
  previousStock: number;
  newStock: number;
  note?: string;
  reason?: string;
  reversalMovementId?: string;
  correctionGroupId?: string;
  status?: 'active' | 'reversed' | 'corrected';
}

export interface Transaction extends BaseEntity {
  type: 'sale' | 'service' | 'expense' | 'reversal' | 'credit_payment';
  amount: number;
  paymentMethod: 'cash' | 'transfer' | 'credit';
  status: 'completed' | 'voided' | 'pending' | 'active' | 'edited' | 'reversed';
  customer?: string; // localId of customer
  customerId?: string;
  supplierId?: string;
  category?: string; // For expenses
  note?: string;
  items?: TransactionItem[];
  isEdited?: boolean;
  isReversed?: boolean;
  originalTransactionId?: string;
  reversalTransactionId?: string;
  correctionVersion?: number;
  correctionReason?: string;
  reversalReason?: string;
  manualReviewRequired?: boolean;
  refundRequired?: boolean;
  sourceType?: 'sale' | 'service' | 'expense' | 'credit_payment' | 'inventory';
  sourceId?: string;
  reversedAt?: Date;
  reversedBy?: string;
  correctedAt?: Date;
  correctedBy?: string;
  previousTransactionId?: string;
  originalPayload?: Partial<Transaction>;
  correctedPayload?: Partial<Transaction>;
}

export interface TransactionItem {
  productId: string;
  quantity: number;
  price: number;
  cost?: number; // Snapshot of cost at time of sale for accurate COGS
}

export interface LedgerEntry extends BaseEntity {
  transactionId: string;
  accountName: string; // e.g., 'Cash', 'Revenue', 'Inventory', 'COGS', 'Receivables', 'Expenses'
  debit: number;
  credit: number;
  reversalOfEntryId?: string;
  correctionGroupId?: string;
  isReversal?: boolean;
  isCorrection?: boolean;
}

export interface Customer extends BaseEntity {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalDebt: number;
}

export interface Supplier extends BaseEntity {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Receivable extends BaseEntity {
  transactionId: string;
  customerId: string;
  amount: number;
  paidAmount: number;
  dueDate?: Date;
  status: 'pending' | 'partially-paid' | 'paid' | 'voided';
}

export interface Receipt extends BaseEntity {
  transactionId: string;
  receiptNumber: string;
  data: string; // JSON blob of receipt content
}

export interface AppSetting {
  id?: number;
  key: string;
  value: any;
  updatedAt: Date;
}

export interface AuditLog extends BaseEntity {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  oldValue?: any;
  reason?: string;
}

export interface SyncQueue {
  id?: number;
  table: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  retryCount?: number;
  status?: 'pending' | 'syncing' | 'failed';
}
