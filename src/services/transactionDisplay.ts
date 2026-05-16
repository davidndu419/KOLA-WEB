import { db } from '@/db/dexie';
import type { Product, Sale, SaleItem, Service, Transaction } from '@/db/schema';

export type DisplaySaleItem = SaleItem & {
  name: string;
  sku?: string;
  barcode?: string;
  original_price?: number;
};

export type DisplayTransaction = Transaction & {
  items?: DisplaySaleItem[];
  service?: Service;
  service_name?: string;
  display_title?: string;
  item_names?: string[];
};

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseCustomerFromNote(note?: string) {
  if (!note) return undefined;
  const match = note.match(/^customer:\s*(.+)$/i);
  return match?.[1]?.trim();
}

export function getSaleTitle(transaction: DisplayTransaction) {
  const names = transaction.item_names || transaction.items?.map((item) => item.name).filter(Boolean) || [];
  if (names.length === 1) return names[0];
  if (names.length > 1) return `${names[0]} + ${names.length - 1} more`;
  return transaction.display_title || 'Product sale';
}

export function getServiceTitle(transaction: DisplayTransaction) {
  return transaction.service_name || transaction.category_name || transaction.service?.name || transaction.note || 'Service';
}

export function getTransactionTitle(transaction: DisplayTransaction) {
  if (transaction.type === 'sale') return getSaleTitle(transaction);
  if (transaction.type === 'service') return getServiceTitle(transaction);
  if (transaction.source_type === 'restock') return 'Restock';
  if (transaction.type === 'expense') return transaction.category_name || 'Expense';
  if (transaction.type === 'credit_payment') return 'Credit Payment';
  if (transaction.type === 'reversal') return 'Reversal';
  if (transaction.status === 'edited') return 'Correction';
  return transaction.display_title || transaction.type;
}

export function getTransactionCustomerLabel(transaction: DisplayTransaction) {
  return transaction.customer_name || parseCustomerFromNote(transaction.note);
}

export function getTransactionSearchText(transaction: DisplayTransaction) {
  const typeLabels = [
    transaction.type,
    transaction.source_type,
    transaction.source_type === 'restock' ? 'restock inventory purchase' : '',
    transaction.type === 'credit_payment' ? 'credit' : '',
    transaction.type === 'reversal' ? 'reversal' : '',
    transaction.status === 'edited' ? 'correction modified' : '',
  ];

  const itemText = (transaction.items || [])
    .flatMap((item) => [item.name, item.sku, item.barcode, item.quantity, item.unit_price, item.total_price, item.cost])
    .join(' ');

  return [
    getTransactionTitle(transaction),
    ...typeLabels,
    transaction.amount,
    transaction.payment_method,
    transaction.status,
    transaction.category_name,
    transaction.service_name,
    transaction.service?.name,
    transaction.note,
    getTransactionCustomerLabel(transaction),
    transaction.local_id,
    transaction.reference_id,
    itemText,
  ].map(normalize).join(' ');
}

export function filterTransactionsForSearch<T extends DisplayTransaction>(transactions: T[], query?: string) {
  const needle = normalize(query).trim();
  if (!needle) return transactions;
  return transactions.filter((transaction) => getTransactionSearchText(transaction).includes(needle));
}

export async function enrichTransactionsForDisplay(transactions: Transaction[]): Promise<DisplayTransaction[]> {
  if (transactions.length === 0) return [];

  const transactionIds = unique(transactions.map((transaction) => transaction.local_id));
  const saleReferenceIds = unique(transactions.filter((transaction) => transaction.type === 'sale').map((transaction) => transaction.reference_id));
  const serviceTransactionIds = transactionIds;

  const [salesByTransaction, salesByReference, services, customers] = await Promise.all([
    transactionIds.length ? db.sales.where('transaction_id').anyOf(transactionIds).toArray() : Promise.resolve([] as Sale[]),
    saleReferenceIds.length ? db.sales.where('local_id').anyOf(saleReferenceIds).toArray() : Promise.resolve([] as Sale[]),
    serviceTransactionIds.length ? db.services.where('transaction_id').anyOf(serviceTransactionIds).toArray() : Promise.resolve([] as Service[]),
    db.customers.toArray(),
  ]);

  const sales = [...salesByTransaction, ...salesByReference];
  const saleByTransactionId = new Map(sales.map((sale) => [sale.transaction_id, sale]));
  const saleByLocalId = new Map(sales.map((sale) => [sale.local_id, sale]));
  const saleIds = unique(sales.map((sale) => sale.local_id));
  const saleItems = saleIds.length ? await db.sale_items.where('sale_id').anyOf(saleIds).toArray() : [];
  const productIds = unique(saleItems.map((item) => item.product_id));
  const products = productIds.length ? await db.products.where('local_id').anyOf(productIds).toArray() : [];

  const productMap = new Map(products.map((product: Product) => [product.local_id, product]));
  const customerMap = new Map(customers.map((customer) => [customer.local_id, customer]));
  const serviceMap = new Map(services.map((service) => [service.transaction_id, service]));
  const saleItemMap = new Map<string, DisplaySaleItem[]>();

  for (const item of saleItems) {
    const product = productMap.get(item.product_id);
    const enrichedItem: DisplaySaleItem = {
      ...item,
      name: product?.name || 'Archived product',
      sku: product?.sku,
      barcode: product?.barcode,
      original_price: product?.selling_price,
    };
    const existing = saleItemMap.get(item.sale_id) || [];
    existing.push(enrichedItem);
    saleItemMap.set(item.sale_id, existing);
  }

  return transactions.map((transaction) => {
    const sale = saleByLocalId.get(transaction.reference_id) || saleByTransactionId.get(transaction.local_id);
    const service = serviceMap.get(transaction.local_id);
    const customer = transaction.customer_id ? customerMap.get(transaction.customer_id) : undefined;
    const items = sale ? saleItemMap.get(sale.local_id) || [] : [];
    const itemNames = items.map((item) => item.name).filter(Boolean);
    const customerName = transaction.customer_name || customer?.name || parseCustomerFromNote(transaction.note);

    const displayTransaction: DisplayTransaction = {
      ...transaction,
      customer_name: customerName,
      items,
      item_names: itemNames,
      service,
      service_name: service?.name || transaction.service_name,
    };

    displayTransaction.display_title = getTransactionTitle(displayTransaction);
    return displayTransaction;
  });
}
