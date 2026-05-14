const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /localId/g, to: 'local_id' },
  { from: /businessId/g, to: 'business_id' },
  { from: /createdAt/g, to: 'created_at' },
  { from: /updatedAt/g, to: 'updated_at' },
  { from: /deletedAt/g, to: 'deleted_at' },
  { from: /syncStatus/g, to: 'sync_status' },
  { from: /transactionId/g, to: 'transaction_id' },
  { from: /productId/g, to: 'product_id' },
  { from: /customerId/g, to: 'customer_id' },
  { from: /supplierId/g, to: 'supplier_id' },
  { from: /categoryId/g, to: 'category_id' },
  { from: /paymentMethod/g, to: 'payment_method' },
  { from: /isArchived/g, to: 'is_archived' },
  { from: /buyingPrice/g, to: 'buying_price' },
  { from: /sellingPrice/g, to: 'selling_price' },
  { from: /profitMargin/g, to: 'profit_margin' },
  { from: /unitType/g, to: 'unit_type' },
  { from: /minStock/g, to: 'min_stock' },
  { from: /maxStock/g, to: 'max_stock' },
  { from: /expiryDate/g, to: 'expiry_date' },
  { from: /imageUrl/g, to: 'image_url' },
  { from: /totalDebt/g, to: 'total_debt' },
  { from: /contactName/g, to: 'contact_name' },
  { from: /reversalOfEntryId/g, to: 'reversal_of_entry_id' },
  { from: /paidAmount/g, to: 'paid_amount' },
  { from: /dueDate/g, to: 'due_date' },
  { from: /receiptNumber/g, to: 'receipt_number' },
  { from: /entityType/g, to: 'entity_type' },
  { from: /entityId/g, to: 'entity_id' },
  { from: /oldValue/g, to: 'old_value' },
  { from: /newValue/g, to: 'new_value' },
  { from: /accountName/g, to: 'account_name' },
  { from: /totalAmount/g, to: 'total_amount' },
  { from: /discountAmount/g, to: 'discount_amount' },
  { from: /taxAmount/g, to: 'tax_amount' },
  { from: /netAmount/g, to: 'net_amount' },
  { from: /unitPrice/g, to: 'unit_price' },
  { from: /totalPrice/g, to: 'total_price' },
  { from: /costPrice/g, to: 'cost_price' },
  { from: /tableName/g, to: 'table_name' },
  { from: /previousStock/g, to: 'previous_stock' },
  { from: /newStock/g, to: 'new_stock' },
  { from: /cost_price/g, to: 'cost' } // Schema says cost in some places
];


function walk(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walk(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      replacements.forEach(r => {
        if (r.from.test(content)) {
          content = content.replace(r.from, r.to);
          changed = true;
        }
      });
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated: ${fullPath}`);
      }
    }
  });
}

walk('./src');
