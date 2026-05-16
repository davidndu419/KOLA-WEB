-- Phase 6A: WAC Foundation
-- Add WAC fields to products and inventory_movements

-- 1. Update products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS wac_price DECIMAL(12, 2);

-- 2. Update inventory_movements table
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12, 2);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 2);

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_wac_price ON products(wac_price);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_unit_cost ON inventory_movements(unit_cost);

-- 4. Initial backfill for products (safe default)
-- If wac_price is NULL, set it to buying_price
UPDATE products SET wac_price = buying_price WHERE wac_price IS NULL;

-- 5. Initial backfill for inventory_movements
-- Note: This is a best-effort backfill using current product price if available
UPDATE inventory_movements im
SET unit_cost = p.buying_price,
    total_cost = p.buying_price * im.quantity
FROM products p
WHERE im.product_id = p.id 
  AND im.unit_cost IS NULL
  AND (im.type = 'stock-in' OR im.type = 'return');
