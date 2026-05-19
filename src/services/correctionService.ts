import { db, createBaseEntity } from '@/db/dexie';
import { LedgerEntry, SaleItem, Transaction } from '@/db/schema';
import { syncQueueService } from './syncQueueService';
import { processAccounting } from '@/accounting/engine';
import { assertBalanced, assertCashSolvencyForEntries } from '@/accounting/guards';
import { assertWithinModificationWindow } from './transactionModificationGuards';
import { getCurrentAuthenticatedUserId } from '@/lib/auth-user';

type CorrectedSaleItemInput = {
  product_id: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  cost?: number;
};

type CorrectionInput = Partial<Transaction> & {
  items?: CorrectedSaleItemInput[];
};

function toMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function createCorrectionReversalEntries(
  transaction_id: string,
  business_id: string,
  correctionGroupId: string
) {
  const originalEntries = await db.ledger_entries.where('transaction_id').equals(transaction_id).toArray();
  const reversalEntries: LedgerEntry[] = originalEntries.map((entry: any) => ({
    ...createBaseEntity(business_id),
    transaction_id,
    source_type: entry.source_type,
    source_id: entry.source_id,
    debit_account: entry.credit_account,
    credit_account: entry.debit_account,
    amount: entry.amount,
    is_reversal: false,
    is_correction: true,
    reversal_of_entry_id: entry.local_id,
    correction_group_id: correctionGroupId,
    description: `Correction reverse: ${entry.description || transaction_id}`,
  } as LedgerEntry));

  if (reversalEntries.length === 0) return [];

  assertBalanced(reversalEntries);
  await assertCashSolvencyForEntries(reversalEntries, business_id);
  await db.ledger_entries.bulkAdd(reversalEntries);
  await syncQueueService.enqueueMany(
    reversalEntries.map((entry) => ({
      entity: 'ledger_entries',
      action: 'create',
      payload: entry,
      business_id,
    }))
  );

  return reversalEntries;
}

async function restoreOriginalSaleStock(originalItems: SaleItem[], business_id: string, transaction_id: string) {
  for (const item of originalItems) {
    const product = await db.products.where('local_id').equals(item.product_id).first();
    if (!product) continue;

    const newStock = (product.stock || 0) + item.quantity;
    const updatedProduct = {
      ...product,
      stock: newStock,
      updated_at: new Date(),
      sync_status: 'pending' as const,
    };
    await db.products.update(product.id!, updatedProduct);
    await syncQueueService.enqueue('products', 'update', updatedProduct, business_id);

    const movement = {
      ...createBaseEntity(business_id),
      product_id: item.product_id,
      type: 'return' as const,
      quantity: item.quantity,
      previous_stock: product.stock || 0,
      new_stock: newStock,
      note: `Correction reverse: ${transaction_id}`,
      status: 'corrected' as const,
      unit_cost: item.cost || product.wac_price || product.buying_price || 0,
      total_cost: item.quantity * (item.cost || product.wac_price || product.buying_price || 0),
    };
    await db.inventory_movements.add(movement);
    await syncQueueService.enqueue('inventory_movements', 'create', movement, business_id);
  }
}

async function buildCorrectedSaleItems(
  inputItems: CorrectedSaleItemInput[],
  existingItems: SaleItem[],
  sale_id: string,
  business_id: string
): Promise<SaleItem[]> {
  if (inputItems.length === 0) {
    throw new Error('Correction cannot be completed because stock would become negative.');
  }

  const existingByProduct = new Map(existingItems.map((item) => [item.product_id, item]));
  const requestedByProduct = new Map<string, CorrectedSaleItemInput>();

  for (const input of inputItems) {
    if (!input.product_id) continue;
    const current = requestedByProduct.get(input.product_id);
    requestedByProduct.set(input.product_id, {
      ...input,
      quantity: (current?.quantity || 0) + (Number(input.quantity) || 0),
      unit_price: input.unit_price ?? input.price ?? current?.unit_price ?? current?.price,
      price: input.price ?? input.unit_price ?? current?.price ?? current?.unit_price,
    });
  }

  const saleItems: SaleItem[] = [];
  for (const input of requestedByProduct.values()) {
    const product = await db.products.where('local_id').equals(input.product_id).first();
    if (!product || product.deleted_at || product.is_archived) {
      throw new Error('Correction cannot be completed because stock would become negative.');
    }

    const quantity = Number(input.quantity) || 0;
    const currentStock = product.stock || 0;
    if (quantity <= 0 || currentStock < quantity) {
      throw new Error('Correction cannot be completed because stock would become negative.');
    }

    const existing = existingByProduct.get(input.product_id);
    const unitPrice = toMoney(input.unit_price ?? input.price ?? existing?.unit_price ?? product.selling_price ?? 0);
    const cost = toMoney(product.wac_price ?? existing?.cost ?? product.buying_price ?? 0);

    saleItems.push({
      ...createBaseEntity(business_id),
      local_id: existing?.local_id || crypto.randomUUID(),
      sale_id,
      product_id: input.product_id,
      quantity,
      unit_price: unitPrice,
      total_price: toMoney(quantity * unitPrice),
      cost,
      sync_status: 'pending',
    });
  }

  return saleItems;
}

async function replaceSaleItems(
  sale_id: string,
  oldItems: SaleItem[],
  correctedItems: SaleItem[],
  business_id: string
) {
  const correctedIds = new Set(correctedItems.map((item) => item.local_id));

  for (const oldItem of oldItems) {
    if (!correctedIds.has(oldItem.local_id) && oldItem.id !== undefined) {
      await db.sale_items.delete(oldItem.id);
      await syncQueueService.enqueue('sale_items', 'delete', oldItem, business_id);
    }
  }

  for (const item of correctedItems) {
    const existing = oldItems.find((oldItem) => oldItem.local_id === item.local_id);
    if (existing?.id !== undefined) {
      const updatedItem = { ...existing, ...item, id: existing.id, updated_at: new Date(), sync_status: 'pending' as const };
      await db.sale_items.update(existing.id, updatedItem);
      await syncQueueService.enqueue('sale_items', 'update', updatedItem, business_id);
      continue;
    }

    await db.sale_items.add(item);
    await syncQueueService.enqueue('sale_items', 'create', item, business_id);
  }
}

async function syncReceivableForCorrection(original: Transaction, updated: Transaction, business_id: string) {
  if (updated.type !== 'sale' && updated.type !== 'service') return;

  const existingReceivable = await db.receivables.where('transaction_id').equals(original.local_id).first();
  const oldOutstanding = existingReceivable
    ? Math.max(0, (existingReceivable.amount || 0) - (existingReceivable.paid_amount || 0))
    : 0;

  if (updated.payment_method === 'credit') {
    const customerId = updated.customer_id || original.customer_id;
    if (!customerId) return;

    if (existingReceivable) {
      const paidAmount = Math.min(existingReceivable.paid_amount || 0, updated.amount);
      const status = paidAmount >= updated.amount ? 'paid' : paidAmount > 0 ? 'partially-paid' : 'pending';
      const updatedReceivable = {
        ...existingReceivable,
        customer_id: customerId,
        amount: updated.amount,
        paid_amount: paidAmount,
        status: status as 'pending' | 'partially-paid' | 'paid',
        updated_at: new Date(),
        sync_status: 'pending' as const,
      };
      await db.receivables.update(existingReceivable.id!, updatedReceivable);
      await syncQueueService.enqueue('receivables', 'update', updatedReceivable, business_id);
    } else {
      const receivable = {
        ...createBaseEntity(business_id),
        transaction_id: updated.local_id,
        customer_id: customerId,
        amount: updated.amount,
        paid_amount: 0,
        status: 'pending' as const,
        due_date: new Date(Date.now() + (updated.type === 'sale' ? 30 : 14) * 24 * 60 * 60 * 1000),
      };
      await db.receivables.add(receivable);
      await syncQueueService.enqueue('receivables', 'create', receivable, business_id);
    }

    const newOutstanding = Math.max(0, updated.amount - (existingReceivable?.paid_amount || 0));
    const debtDelta = newOutstanding - oldOutstanding;
    if (debtDelta !== 0) {
      const customer = await db.customers.where('local_id').equals(customerId).first();
      if (customer) {
        const updatedCustomer = {
          ...customer,
          total_debt: Math.max(0, (customer.total_debt || 0) + debtDelta),
          updated_at: new Date(),
          sync_status: 'pending' as const,
        };
        await db.customers.update(customer.id!, updatedCustomer);
        await syncQueueService.enqueue('customers', 'update', updatedCustomer, business_id);
      }
    }
    return;
  }

  if (existingReceivable) {
    const updatedReceivable = {
      ...existingReceivable,
      status: 'voided' as const,
      updated_at: new Date(),
      sync_status: 'pending' as const,
    };
    await db.receivables.update(existingReceivable.id!, updatedReceivable);
    await syncQueueService.enqueue('receivables', 'update', updatedReceivable, business_id);

    const customer = await db.customers.where('local_id').equals(existingReceivable.customer_id).first();
    if (customer && oldOutstanding > 0) {
      const updatedCustomer = {
        ...customer,
        total_debt: Math.max(0, (customer.total_debt || 0) - oldOutstanding),
        updated_at: new Date(),
        sync_status: 'pending' as const,
      };
      await db.customers.update(customer.id!, updatedCustomer);
      await syncQueueService.enqueue('customers', 'update', updatedCustomer, business_id);
    }
  }
}

export const correctionService = {
  async correctTransaction(
    transaction_id: string,
    updatedData: CorrectionInput,
    reason: string,
    business_id: string
  ) {
    const original = await db.transactions.where('local_id').equals(transaction_id).first();
    if (!original) throw new Error('Transaction not found');
    if (original.status === 'reversed' || original.is_reversed) throw new Error('Cannot correct a reversed transaction');
    assertWithinModificationWindow(original.created_at);
    const userId = await getCurrentAuthenticatedUserId();

    return await db.transaction('rw', [
      db.transactions,
      db.ledger_entries,
      db.products,
      db.inventory_movements,
      db.receivables,
      db.customers,
      db.audit_logs,
      db.sync_queue,
      db.sales,
      db.sale_items,
      db.services,
      db.expenses
    ], async () => {
      const correctionGroupId = crypto.randomUUID();
      const originalSale = original.type === 'sale'
        ? await db.sales.where('local_id').equals(original.reference_id).first()
        : null;
      const originalSaleItems = originalSale
        ? await db.sale_items.where('sale_id').equals(originalSale.local_id).toArray()
        : [];

      await createCorrectionReversalEntries(transaction_id, business_id, correctionGroupId);

      if (original.type === 'sale') {
        await restoreOriginalSaleStock(originalSaleItems, business_id, transaction_id);
      }

      const correction_version = ((original as any).correction_version || 0) + 1;
      const updatedTx: Transaction = {
        ...original,
        ...updatedData,
        status: 'edited',
        is_edited: true,
        correction_version,
        corrected_at: new Date(),
        original_payload: original.original_payload || original,
        updated_at: new Date(),
        sync_status: 'pending',
      };

      let correctedSaleItems: SaleItem[] | undefined;
      if (original.type === 'sale') {
        if (!originalSale) throw new Error('Original sale record not found');
        correctedSaleItems = await buildCorrectedSaleItems(
          updatedData.items || originalSaleItems,
          originalSaleItems,
          originalSale.local_id,
          business_id
        );
        updatedTx.amount = toMoney(correctedSaleItems.reduce((total, item) => total + item.total_price, 0));
        updatedTx.item_names = await Promise.all(correctedSaleItems.map(async (item) => {
          const product = await db.products.where('local_id').equals(item.product_id).first();
          return product?.name || 'Archived product';
        }));
        updatedTx.display_title = updatedTx.item_names.length === 1
          ? updatedTx.item_names[0]
          : updatedTx.item_names.length > 1
            ? `${updatedTx.item_names[0]} + ${updatedTx.item_names.length - 1} more`
            : 'Product sale';

        const updatedSale = {
          ...originalSale,
          total_amount: updatedTx.amount,
          net_amount: updatedTx.amount,
          payment_method: updatedTx.payment_method,
          note: updatedTx.note,
          status: 'completed' as const,
          updated_at: new Date(),
          sync_status: 'pending' as const,
        };
        await db.sales.update(originalSale.id!, updatedSale);
        await syncQueueService.enqueue('sales', 'update', updatedSale, business_id);
        await replaceSaleItems(originalSale.local_id, originalSaleItems, correctedSaleItems, business_id);
      }

      if (original.type === 'expense') {
        const expense = await db.expenses.where('local_id').equals(original.reference_id).first();
        if (expense) {
          const updatedExpense = {
            ...expense,
            amount: updatedTx.amount,
            payment_method: updatedTx.payment_method as 'cash' | 'transfer',
            note: updatedTx.note,
            status: 'completed' as const,
            updated_at: new Date(),
            sync_status: 'pending' as const,
          };
          await db.expenses.update(expense.id!, updatedExpense);
          await syncQueueService.enqueue('expenses', 'update', updatedExpense, business_id);
        }
      }

      if (original.type === 'service') {
        const service = await db.services.where('local_id').equals(original.reference_id).first();
        if (service) {
          const updatedService = {
            ...service,
            amount: updatedTx.amount,
            payment_method: updatedTx.payment_method,
            note: updatedTx.note,
            status: 'completed' as const,
            updated_at: new Date(),
            sync_status: 'pending' as const,
          };
          await db.services.update(service.id!, updatedService);
          await syncQueueService.enqueue('services', 'update', updatedService, business_id);
        }
      }

      await db.transactions.update(original.id!, updatedTx as any);
      await processAccounting(updatedTx, correctedSaleItems, { isCorrection: true, correctionGroupId });
      await syncReceivableForCorrection(original, updatedTx, business_id);

      const auditLog = {
        ...createBaseEntity(business_id),
        sync_status: userId ? 'pending' as const : 'failed' as const,
        user_id: userId,
        action: 'corrected',
        entity_type: 'transaction',
        entity_id: transaction_id,
        reason,
        old_value: original,
        new_value: updatedTx,
      };
      await db.audit_logs.add(auditLog as any);

      await syncQueueService.enqueue('transactions', 'update', updatedTx, business_id);
      if (userId) {
        await syncQueueService.enqueue('audit_logs', 'create', auditLog, business_id);
      }

      return updatedTx;
    });
  }
};
