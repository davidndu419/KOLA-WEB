// src/accounting/inventory.ts
import { db, createBaseEntity } from '@/db/dexie';
import { Product, InventoryMovement } from '@/db/schema';

export async function adjustStock(
  productId: string, 
  quantity: number, 
  type: InventoryMovement['type'],
  note?: string,
  reason?: string
) {
  return await db.transaction('rw', [db.products, db.inventory_movements, db.ledger_entries, db.sync_queue], async () => {
    const product = await db.products.where('localId').equals(productId).first();
    if (!product) throw new Error('Product not found');

    const previousStock = product.stock;
    let newStock = previousStock;

    if (type === 'stock-in' || type === 'return') {
      newStock += quantity;
    } else if (type === 'stock-out' || type === 'damage') {
      newStock -= quantity;
    } else if (type === 'adjustment') {
      newStock = quantity; // For adjustment, quantity is the new target
    }

    if (newStock < 0) throw new Error('Stock cannot be negative');

    // 1. Update Product
    await db.products.update(product.id!, {
      stock: newStock,
      updatedAt: new Date(),
      syncStatus: 'pending'
    });

    // 2. Create Movement Log
    const movementBase = createBaseEntity(product.businessId);
    const movement: Omit<InventoryMovement, 'id'> = {
      ...movementBase,
      productId,
      type,
      quantity: Math.abs(newStock - previousStock),
      previousStock,
      newStock,
      note,
      reason
    };
    await db.inventory_movements.add(movement as any);

    // 3. Accounting Impact (Optional for manual adjustments, but good for inventory valuation)
    if (type === 'stock-in' || type === 'damage') {
      const valueChange = (newStock - previousStock) * product.buyingPrice;
      const ledgerBase = createBaseEntity(product.businessId);
      
      // Debit/Credit Inventory
      await db.ledger_entries.add({
        ...ledgerBase,
        transactionId: movement.localId,
        accountName: 'Inventory',
        debit: valueChange > 0 ? valueChange : 0,
        credit: valueChange < 0 ? Math.abs(valueChange) : 0,
      } as any);

      // Balancing Entry (Capital/Shrinkage)
      await db.ledger_entries.add({
        ...ledgerBase,
        transactionId: movement.localId,
        accountName: valueChange > 0 ? 'Business Capital' : 'Inventory Shrinkage',
        debit: valueChange < 0 ? Math.abs(valueChange) : 0,
        credit: valueChange > 0 ? valueChange : 0,
      } as any);
    }

    // 4. Add to sync queue
    await db.sync_queue.add({
      table: 'inventory_movements',
      action: 'create',
      data: movement,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    });

    return movement;
  });
}
