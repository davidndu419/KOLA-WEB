// src/db/schema.ts


export interface BaseEntity {
  id?: number;
  local_id: string;
  business_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'conflict';
  version: number;
  device_id: string;
}

export interface Business extends BaseEntity {
  user_id: string;
  business_name: string;
  business_type: string;
  name: string;
  type: string;
  currency: string;
}

export interface Product extends BaseEntity {
  name: string;
  sku?: string;
  barcode?: string;
  category_id?: string;
  unit_type: 'piece' | 'kg' | 'liter' | 'pack' | 'set';
  buying_price: number;
  selling_price: number;
  profit_margin: number;
  stock: number;
  min_stock: number;
  max_stock?: number;
  supplier_id?: string;
  expiry_date?: Date | null;
  image_url?: string;
  notes?: string;
  tags?: string[];
  is_archived: boolean;
}

export interface ProductWithCategory extends Product {
  category?: string;
}


export interface Category extends BaseEntity {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface ServiceCategory extends BaseEntity {
  name: string;
  description?: string;
  default_price?: number;
  status: 'active' | 'inactive';
}

export interface InventoryMovement extends BaseEntity {
  product_id: string;
  type: 'stock-in' | 'stock-out' | 'adjustment' | 'damage' | 'return';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  note?: string;
  reason?: string;
  status?: 'active' | 'reversed' | 'corrected';
}

export interface Sale extends BaseEntity {
  transaction_id: string;
  customer_id?: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  payment_method: 'cash' | 'transfer' | 'credit';
  status: 'completed' | 'voided' | 'pending';
  note?: string;
}

export interface SaleItem extends BaseEntity {
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  cost: number;
}

export interface Service extends BaseEntity {
  transaction_id: string;
  name: string;
  category_id?: string;
  customer_id?: string;
  amount: number;
  payment_method: 'cash' | 'transfer' | 'credit';
  status: 'completed' | 'voided';
  note?: string;
}

export interface Expense extends BaseEntity {
  transaction_id: string;
  category_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  recipient?: string;
  note?: string;
  status: 'completed' | 'voided';
}

export interface Transaction extends BaseEntity {
  type: 'sale' | 'service' | 'expense' | 'reversal' | 'credit_payment' | 'adjustment';
  amount: number;
  payment_method: 'cash' | 'transfer' | 'credit';
  status: 'completed' | 'voided' | 'pending' | 'active' | 'edited' | 'reversed';
  reference_id: string; // ID of the sale, service, or expense
  customer_id?: string;
  customer_name?: string;
  category_id?: string;
  category_name?: string;
  note?: string;
  is_reversed?: boolean;
  is_edited?: boolean;
  reversal_reason?: string;
  original_transaction_id?: string;
  source_type?: string;
  source_id?: string;
  correction_version?: number;
  corrected_at?: Date;
  original_payload?: any;
}


export interface TransactionWithItems extends Transaction {
  items?: any[];
}



export interface LedgerEntry extends BaseEntity {
  transaction_id: string;
  source_type?: string;
  source_id?: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  description?: string;
  is_correction?: boolean;
  reversal_of_entry_id?: string;
  correction_group_id?: string;
  is_reversal?: boolean;
}





export interface Customer extends BaseEntity {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  total_debt: number;
}

export interface Supplier extends BaseEntity {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Receivable extends BaseEntity {
  transaction_id: string;
  customer_id: string;
  amount: number;
  paid_amount: number;
  due_date?: Date;
  status: 'pending' | 'partially-paid' | 'paid' | 'voided';
}

export interface Receipt extends BaseEntity {
  transaction_id: string;
  receipt_number: string;
  data: string;
}

export interface AppSetting {
  id?: number;
  business_id: string;
  key: string;
  value: any;
  updated_at: Date;
}

export interface AuditLog extends BaseEntity {
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
}

export interface SyncQueue {
  id?: number;
  business_id: string;
  entity: string;       // table name
  entity_id: string;    // local_id of the entity
  action: 'create' | 'update' | 'delete';
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  retry_count: number;
  error?: string;
  created_at: Date;
}


