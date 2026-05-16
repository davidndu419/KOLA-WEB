import { db, createBaseEntity } from '@/db/dexie';
import { Product, InventoryMovement, LedgerEntry } from '@/db/schema';
import { syncQueueService } from '@/services/syncQueueService';

export async function adjustStock(
  product_id: string, 
  quantity: number, 
  type: InventoryMovement['type'],
  note?: string,
  reason?: string,
  unitCost?: number,
  skipLedger?: boolean
) {
  return await db.transaction('rw', [db.products, db.inventory_movements, db.ledger_entries, db.sync_queue], async () => {
    const product = await db.products.where('local_id').equals(product_id).first();
    if (!product) throw new Error('Product not found');

    const previous_stock = product.stock;
    let new_stock = previous_stock;

    if (type === 'stock-in' || type === 'return') {
      new_stock += quantity;
    } else if (type === 'stock-out' || type === 'damage') {
      new_stock -= quantity;
    } else if (type === 'adjustment') {
      new_stock = quantity; // For adjustment, quantity is the new target
    }

    if (new_stock < 0) throw new Error('Stock cannot be negative');

    const movementUnitCost = unitCost ?? product.buying_price ?? 0;
    const movementQuantity = Math.abs(new_stock - previous_stock);

    // 1. Update Product
    const updatedProduct = {
      ...product,
      stock: new_stock,
      updated_at: new Date(),
      sync_status: 'pending' as const
    };
    await db.products.update(product.id!, updatedProduct);
    await syncQueueService.enqueue('products', 'update', updatedProduct, product.business_id);

    // 2. Create Movement Log
    const movementBase = createBaseEntity(product.business_id);
    const movement: InventoryMovement = {
      ...movementBase,
      product_id: product_id,
      type,
      quantity: movementQuantity,
      previous_stock,
      new_stock,
      note,
      reason,
      status: 'active',
      unit_cost: movementUnitCost,
      total_cost: movementQuantity * movementUnitCost
    };
    await db.inventory_movements.add(movement);
    await syncQueueService.enqueue('inventory_movements', 'create', movement, product.business_id);

    // 3. Accounting Impact
    if (skipLedger) return movement;
    
    if (type === 'stock-in' || type === 'damage' || type === 'adjustment') {
      const valueChange = (new_stock - previous_stock) * movementUnitCost;
      if (valueChange === 0) return movement;

      const entry: Omit<LedgerEntry, 'id'> = {
        ...createBaseEntity(product.business_id),
        local_id: crypto.randomUUID(),
        transaction_id: movement.local_id,
        source_type: 'inventory_adjustment',
        source_id: movement.local_id,
        debit_account: valueChange > 0 ? 'Inventory' : 'Inventory Shrinkage',
        credit_account: valueChange > 0 ? 'Business Capital' : 'Inventory',
        amount: Math.abs(valueChange),
        is_reversal: false,
        is_correction: false,
        description: `Inventory Adjustment: ${reason || note || 'Manual'}`
      };

      await db.ledger_entries.add(entry as LedgerEntry);

      await syncQueueService.enqueue('ledger_entries', 'create', entry, product.business_id);
    }

    return movement;
  });
}
