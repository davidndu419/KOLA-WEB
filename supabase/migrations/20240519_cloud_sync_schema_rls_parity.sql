-- KOLA Cloud Sync Schema + RLS Parity
-- Run this in Supabase to make the cloud schema accept the current Dexie/offline sync payloads.
-- This migration intentionally preserves existing data and relaxes legacy remote-FK assumptions
-- where the offline app syncs local_id references.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. Drop remote-ID foreign keys on columns that the offline app stores as local IDs.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    constraint_record record;
BEGIN
    FOR constraint_record IN
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND (
            (tc.table_name IN (
              'categories',
              'products',
              'customers',
              'suppliers',
              'transactions',
              'sales',
              'services',
              'expenses',
              'sale_items',
              'inventory_movements',
              'ledger_entries',
              'receivables',
              'receipts',
              'app_settings',
              'audit_logs',
              'service_categories',
              'expense_categories'
            ) AND kcu.column_name = 'business_id')
            OR (tc.table_name = 'products' AND kcu.column_name IN ('category_id', 'supplier_id'))
            OR (tc.table_name = 'transactions' AND kcu.column_name IN ('customer_id', 'supplier_id'))
            OR (tc.table_name = 'sales' AND kcu.column_name = 'customer_id')
            OR (tc.table_name = 'services' AND kcu.column_name IN ('customer_id', 'category_id'))
            OR (tc.table_name = 'expenses' AND kcu.column_name = 'category_id')
            OR (tc.table_name = 'sale_items' AND kcu.column_name = 'product_id')
            OR (tc.table_name = 'inventory_movements' AND kcu.column_name = 'product_id')
            OR (tc.table_name = 'receivables' AND kcu.column_name = 'customer_id')
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
            constraint_record.table_name,
            constraint_record.constraint_name
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Ensure category tables exist.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_price DECIMAL(12, 2),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_amount DECIMAL(12, 2),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- 3. Convert offline local-id reference columns to TEXT where needed.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS products ALTER COLUMN category_id TYPE TEXT USING category_id::TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN supplier_id TYPE TEXT USING supplier_id::TEXT;
ALTER TABLE IF EXISTS transactions ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;
ALTER TABLE IF EXISTS transactions ALTER COLUMN supplier_id TYPE TEXT USING supplier_id::TEXT;
ALTER TABLE IF EXISTS sales ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;
ALTER TABLE IF EXISTS services ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;
ALTER TABLE IF EXISTS expenses ALTER COLUMN category_id TYPE TEXT USING category_id::TEXT;
ALTER TABLE IF EXISTS sale_items ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
ALTER TABLE IF EXISTS inventory_movements ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
ALTER TABLE IF EXISTS receivables ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;

-- ---------------------------------------------------------------------------
-- 4. Add/align columns serialized by src/services/sync.service.ts.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';

ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS wac_price DECIMAL(12, 2);

ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS display_title TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS item_names TEXT[];
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS correction_version INTEGER;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS original_payload JSONB;

ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS category_name TEXT;

ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS category_name TEXT;

ALTER TABLE IF EXISTS sale_items ADD COLUMN IF NOT EXISTS sale_id TEXT;
ALTER TABLE IF EXISTS sale_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2);
ALTER TABLE IF EXISTS sale_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(12, 2);
ALTER TABLE IF EXISTS sale_items ALTER COLUMN price DROP NOT NULL;

ALTER TABLE IF EXISTS inventory_movements ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12, 2);
ALTER TABLE IF EXISTS inventory_movements ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 2);

ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS debit_account TEXT;
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS credit_account TEXT;
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS amount DECIMAL(12, 2);
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS reversal_of_entry_id TEXT;
ALTER TABLE IF EXISTS ledger_entries ADD COLUMN IF NOT EXISTS correction_group_id TEXT;
ALTER TABLE IF EXISTS ledger_entries ALTER COLUMN account_name DROP NOT NULL;
ALTER TABLE IF EXISTS ledger_entries ALTER COLUMN debit DROP NOT NULL;
ALTER TABLE IF EXISTS ledger_entries ALTER COLUMN credit DROP NOT NULL;

ALTER TABLE IF EXISTS receipts ALTER COLUMN data TYPE JSONB USING
    CASE
        WHEN data IS NULL THEN NULL
        WHEN pg_typeof(data)::TEXT = 'jsonb' THEN data::JSONB
        ELSE to_jsonb(data)
    END;

-- Backfill friendly business columns.
UPDATE businesses
SET business_name = COALESCE(business_name, name),
    type = COALESCE(type, business_type),
    business_type = COALESCE(business_type, type, 'retail'),
    currency = COALESCE(currency, 'NGN')
WHERE business_name IS NULL OR business_type IS NULL OR type IS NULL OR currency IS NULL;

UPDATE products
SET wac_price = COALESCE(wac_price, buying_price, 0)
WHERE wac_price IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Indexes used by sync, diagnostics, and date/report queries.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_local_id ON businesses(local_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_business_id ON service_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_status ON service_categories(status);
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_status ON expense_categories(status);
CREATE INDEX IF NOT EXISTS idx_transactions_business_created ON transactions(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_services_business_created ON services(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_created ON expenses(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);

-- ---------------------------------------------------------------------------
-- 6. Updated_at triggers for new/changed tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'businesses',
        'categories',
        'products',
        'customers',
        'suppliers',
        'transactions',
        'sales',
        'services',
        'expenses',
        'sale_items',
        'inventory_movements',
        'ledger_entries',
        'receivables',
        'receipts',
        'app_settings',
        'audit_logs',
        'service_categories',
        'expense_categories'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.%I', table_name);
        EXECUTE format(
            'CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            table_name
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS: authenticated users can sync rows for businesses they own.
-- The app stores the offline business UUID in business_id and the businesses row local_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kola_owns_business(row_business_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.businesses b
        WHERE b.owner_id = auth.uid()
          AND (
            b.id = row_business_id
            OR b.local_id = row_business_id::TEXT
            OR b.business_id = row_business_id
          )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS UUID AS $$
    SELECT COALESCE(b.business_id, b.local_id::UUID, b.id)
    FROM public.businesses b
    WHERE b.owner_id = auth.uid()
    ORDER BY b.created_at ASC
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

ALTER TABLE IF EXISTS businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_isolation_policy ON businesses;
DROP POLICY IF EXISTS businesses_select_own ON businesses;
DROP POLICY IF EXISTS businesses_insert_own ON businesses;
DROP POLICY IF EXISTS businesses_update_own ON businesses;
DROP POLICY IF EXISTS businesses_delete_own ON businesses;

CREATE POLICY businesses_select_own ON businesses
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY businesses_insert_own ON businesses
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY businesses_update_own ON businesses
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY businesses_delete_own ON businesses
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'categories',
        'products',
        'customers',
        'suppliers',
        'transactions',
        'sales',
        'services',
        'expenses',
        'sale_items',
        'inventory_movements',
        'ledger_entries',
        'receivables',
        'receipts',
        'app_settings',
        'audit_logs',
        'service_categories',
        'expense_categories'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation ON public.%I', table_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation_policy ON public.%I', table_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I_select_own_business ON public.%I', table_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I_insert_own_business ON public.%I', table_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I_update_own_business ON public.%I', table_name, table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I_delete_own_business ON public.%I', table_name, table_name);

        EXECUTE format(
            'CREATE POLICY %I_select_own_business ON public.%I FOR SELECT TO authenticated USING (public.kola_owns_business(business_id))',
            table_name,
            table_name
        );
        EXECUTE format(
            'CREATE POLICY %I_insert_own_business ON public.%I FOR INSERT TO authenticated WITH CHECK (public.kola_owns_business(business_id))',
            table_name,
            table_name
        );
        EXECUTE format(
            'CREATE POLICY %I_update_own_business ON public.%I FOR UPDATE TO authenticated USING (public.kola_owns_business(business_id)) WITH CHECK (public.kola_owns_business(business_id))',
            table_name,
            table_name
        );
        EXECUTE format(
            'CREATE POLICY %I_delete_own_business ON public.%I FOR DELETE TO authenticated USING (public.kola_owns_business(business_id))',
            table_name,
            table_name
        );
    END LOOP;
END;
$$;

-- Profiles remain user-owned.
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_self_policy ON profiles;
DROP POLICY IF EXISTS profiles_self_select ON profiles;
DROP POLICY IF EXISTS profiles_self_insert ON profiles;
DROP POLICY IF EXISTS profiles_self_update ON profiles;
DROP POLICY IF EXISTS profiles_self_delete ON profiles;

CREATE POLICY profiles_self_select ON profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_self_insert ON profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_self_update ON profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY profiles_self_delete ON profiles
FOR DELETE TO authenticated
USING (id = auth.uid());

NOTIFY pgrst, 'reload schema';
