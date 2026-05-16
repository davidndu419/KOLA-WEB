-- Expense Categories
-- Run this in Supabase before expecting cloud sync for expense category CRUD.

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_status ON expense_categories(status);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_categories_isolation ON expense_categories;
CREATE POLICY expense_categories_isolation
ON expense_categories
FOR ALL
USING (business_id = get_user_business_id());

-- Existing expenses.category_id was originally tied to the generic categories table.
-- Expense categories sync by local_id, so keep this as text for offline-first IDs.
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'expenses'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'category_id'
    LOOP
        EXECUTE format('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END;
$$;

ALTER TABLE expenses
ALTER COLUMN category_id TYPE TEXT USING category_id::TEXT;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS category_name TEXT;
