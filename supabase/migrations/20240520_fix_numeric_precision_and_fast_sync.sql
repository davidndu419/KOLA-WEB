-- KOLA Numeric Precision + Fast Cross-Device Sync
-- Fixes numeric overflow from legacy small precision columns and enables Supabase Realtime.

-- ---------------------------------------------------------------------------
-- 1. Widen numeric columns used by local Dexie sync payloads.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    column_record record;
BEGIN
    FOR column_record IN
        SELECT *
        FROM (VALUES
            -- Products: prices are money, quantities can be fractional, WAC/cost averages need 4dp.
            ('products', 'buying_price', 'NUMERIC(14,2)'),
            ('products', 'selling_price', 'NUMERIC(14,2)'),
            ('products', 'profit_margin', 'NUMERIC(14,4)'),
            ('products', 'stock', 'NUMERIC(14,4)'),
            ('products', 'min_stock', 'NUMERIC(14,4)'),
            ('products', 'max_stock', 'NUMERIC(14,4)'),
            ('products', 'wac_price', 'NUMERIC(14,4)'),

            -- Master journal and transaction tables.
            ('transactions', 'amount', 'NUMERIC(14,2)'),
            ('expenses', 'amount', 'NUMERIC(14,2)'),
            ('services', 'amount', 'NUMERIC(14,2)'),
            ('sales', 'total_amount', 'NUMERIC(14,2)'),
            ('sales', 'discount_amount', 'NUMERIC(14,2)'),
            ('sales', 'tax_amount', 'NUMERIC(14,2)'),
            ('sales', 'net_amount', 'NUMERIC(14,2)'),

            -- Sale item quantities/prices/costs.
            ('sale_items', 'quantity', 'NUMERIC(14,4)'),
            ('sale_items', 'price', 'NUMERIC(14,2)'),
            ('sale_items', 'unit_price', 'NUMERIC(14,2)'),
            ('sale_items', 'total_price', 'NUMERIC(14,2)'),
            ('sale_items', 'cost', 'NUMERIC(14,4)'),

            -- Inventory quantities and valuation totals.
            ('inventory_movements', 'quantity', 'NUMERIC(14,4)'),
            ('inventory_movements', 'previous_stock', 'NUMERIC(14,4)'),
            ('inventory_movements', 'new_stock', 'NUMERIC(14,4)'),
            ('inventory_movements', 'unit_cost', 'NUMERIC(14,4)'),
            ('inventory_movements', 'total_cost', 'NUMERIC(18,2)'),

            -- Ledger and receivables.
            ('ledger_entries', 'amount', 'NUMERIC(14,2)'),
            ('ledger_entries', 'debit', 'NUMERIC(14,2)'),
            ('ledger_entries', 'credit', 'NUMERIC(14,2)'),
            ('receivables', 'amount', 'NUMERIC(14,2)'),
            ('receivables', 'paid_amount', 'NUMERIC(14,2)'),

            -- Category defaults.
            ('service_categories', 'default_price', 'NUMERIC(14,2)'),
            ('expense_categories', 'default_amount', 'NUMERIC(14,2)')
        ) AS columns(table_name, column_name, target_type)
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = column_record.table_name
              AND column_name = column_record.column_name
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I TYPE %s USING ROUND(%I::NUMERIC, %s)',
                column_record.table_name,
                column_record.column_name,
                column_record.target_type,
                column_record.column_name,
                CASE
                    WHEN column_record.target_type LIKE '%(14,4)%' THEN 4
                    ELSE 2
                END
            );
        END IF;
    END LOOP;
END;
$$;

-- Safe defaults for common money/quantity fields.
DO $$
DECLARE
    default_record record;
BEGIN
    FOR default_record IN
        SELECT *
        FROM (VALUES
            ('products', 'buying_price'),
            ('products', 'selling_price'),
            ('products', 'stock'),
            ('products', 'min_stock'),
            ('products', 'wac_price'),
            ('sales', 'discount_amount'),
            ('sales', 'tax_amount'),
            ('customers', 'total_debt'),
            ('receivables', 'paid_amount'),
            ('ledger_entries', 'debit'),
            ('ledger_entries', 'credit')
        ) AS columns(table_name, column_name)
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = default_record.table_name
              AND column_name = default_record.column_name
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT 0',
                default_record.table_name,
                default_record.column_name
            );
        END IF;
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Enable Supabase Realtime publication for sync tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    sync_table text;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH sync_table IN ARRAY ARRAY[
            'transactions',
            'sales',
            'sale_items',
            'services',
            'expenses',
            'products',
            'inventory_movements',
            'ledger_entries',
            'service_categories',
            'expense_categories',
            'receivables',
            'receipts',
            'app_settings'
        ]
        LOOP
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = sync_table
            )
            AND NOT EXISTS (
                SELECT 1
                FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = sync_table
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', sync_table);
            END IF;
        END LOOP;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
