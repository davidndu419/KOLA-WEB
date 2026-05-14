-- KOLA FOUNDATIONAL SCHEMA
-- Offline-First Mobile PWA Architecture
-- Secondary Cloud Sync Layer

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. CORE TABLES

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    owner_id UUID REFERENCES auth.users(id),
    
    -- Metadata
    business_id UUID, -- self reference for consistency across tables
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Profiles (Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id),
    full_name TEXT,
    role TEXT DEFAULT 'owner',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    category_id UUID REFERENCES categories(id),
    unit_type TEXT NOT NULL,
    buying_price DECIMAL(12,2) DEFAULT 0,
    selling_price DECIMAL(12,2) DEFAULT 0,
    profit_margin DECIMAL(5,2),
    stock DECIMAL(12,2) DEFAULT 0,
    min_stock DECIMAL(12,2) DEFAULT 0,
    max_stock DECIMAL(12,2),
    supplier_id UUID,
    expiry_date TIMESTAMPTZ,
    image_url TEXT,
    notes TEXT,
    tags TEXT[],
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    total_debt DECIMAL(12,2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Transactions (Master Journal)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    supplier_id UUID REFERENCES suppliers(id),
    category TEXT,
    note TEXT,
    is_edited BOOLEAN DEFAULT FALSE,
    is_reversed BOOLEAN DEFAULT FALSE,
    original_transaction_id TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Sales (Detailed Sale Data)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    total_amount DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Services
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    name TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    category_id UUID REFERENCES categories(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    recipient TEXT,
    note TEXT,
    status TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);


-- Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    sale_id TEXT NOT NULL,
    product_id UUID REFERENCES products(id),
    quantity DECIMAL(12,2) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    cost DECIMAL(12,2),

    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    type TEXT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    previous_stock DECIMAL(12,2) NOT NULL,
    new_stock DECIMAL(12,2) NOT NULL,
    note TEXT,
    reason TEXT,
    status TEXT DEFAULT 'active',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Ledger Entries
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0,
    is_reversal BOOLEAN DEFAULT FALSE,
    is_correction BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Receivables
CREATE TABLE IF NOT EXISTS receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    receipt_number TEXT NOT NULL,
    data JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1,
    UNIQUE(business_id, key)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    device_id TEXT,
    sync_status TEXT DEFAULT 'synced',
    version INTEGER DEFAULT 1
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_business ON ledger_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_receivables_customer ON receivables(customer_id);

-- 4. TRIGGERS FOR UPDATED_AT
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
    END LOOP;
END;
$$;

-- 5. RLS POLICIES
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;


-- Business isolation policy
CREATE POLICY business_isolation_policy ON businesses 
    FOR ALL USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION get_user_business_id() RETURNS UUID AS $$
    SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Apply isolation to all business-related tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name NOT IN ('businesses', 'profiles') 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE POLICY %I_isolation ON %I FOR ALL USING (business_id = get_user_business_id())', t, t);
    END LOOP;
END;
$$;

CREATE POLICY profile_self_policy ON profiles 
    FOR ALL USING (id = auth.uid());

-- 6. STORAGE BUCKETS (Executed in storage schema)
-- Note: In a real migration, these would be in a separate block or managed via CLI
-- But for completeness:
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('receipts', 'receipts', false),
    ('logos', 'logos', true),
    ('product-images', 'product-images', true),
    ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access for Logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Public Access for Product Images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated Access for Receipts" ON storage.objects FOR ALL USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Access for Exports" ON storage.objects FOR ALL USING (bucket_id = 'exports' AND auth.role() = 'authenticated');
