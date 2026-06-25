declare const Deno: {
  readTextFile(path: string): Promise<string>;
  exit(code?: number): never;
};

const files = {
  bottomNav: await Deno.readTextFile('src/components/bottom-navigation.tsx'),
  transactionRow: await Deno.readTextFile('src/components/transactions/transaction-row.tsx'),
  transactionList: await Deno.readTextFile('src/components/sales/transaction-list.tsx'),
  productList: await Deno.readTextFile('src/components/inventory/product-list.tsx'),
  quickActions: await Deno.readTextFile('src/components/dashboard/quick-actions.tsx'),
  sales: await Deno.readTextFile('src/app/(app)/sales/page.tsx'),
  service: await Deno.readTextFile('src/app/(app)/service/page.tsx'),
  inventory: await Deno.readTextFile('src/app/(app)/inventory/page.tsx'),
  expenses: await Deno.readTextFile('src/app/(app)/expenses/page.tsx'),
  globals: await Deno.readTextFile('src/app/globals.css'),
};

const checks: Array<[string, boolean]> = [
  ['bottom nav uses Link navigation', files.bottomNav.includes('import Link from') && files.bottomNav.includes('<Link')],
  ['bottom nav active state updates instantly based on pathname', files.bottomNav.includes('usePathname()') && files.bottomNav.includes('isActive')],
  ['quick action icons use guarded Touchable', files.quickActions.includes('<Touchable') && files.quickActions.includes('onPress={() => onAction?.(action.label)}')],
  ['transaction rows use guarded Touchable', files.transactionRow.includes('<Touchable onPress={onPress}')],
  ['transaction list opens details from row onPress only', files.transactionList.includes('onPress={() => setSelectedTransaction(tx)}')],
  ['stock item rows use guarded Touchable', files.productList.includes('onPress={() => setSelectedProduct(product)}')],
  ['sales floating action uses guarded Touchable', files.sales.includes('<Touchable') && files.sales.includes('setIsRecordSheetOpen(true)')],
  ['service floating action uses guarded Touchable', files.service.includes('<Touchable') && files.service.includes('setIsRecordSheetOpen(true)')],
  ['inventory add action uses guarded Touchable', files.inventory.includes('<Touchable') && files.inventory.includes("router.push('/inventory/add')")],
  ['expense floating action uses guarded Touchable', files.expenses.includes('<Touchable') && files.expenses.includes('setIsExpenseSheetOpen(true)')],
  ['scroll containers use iOS momentum and contained overscroll', files.globals.includes('-webkit-overflow-scrolling: touch') && files.globals.includes('overscroll-behavior-y: contain')],
  ['interactive controls use touch-action manipulation', files.globals.includes('touch-action: manipulation')]
];

const rawNavigationHandlers = Object.entries(files)
  .filter(([name]) => name !== 'globals')
  .flatMap(([name, content]) => {
    const matches = content.match(/on(TouchStart|PointerDown)=\{[^}]*?(router\.push|setSelected|setIs[A-Za-z]+Open\(true\))/g) || [];
    return matches.map((match) => `${name}: ${match}`);
  });

checks.push(['no mobile navigation opens on touchstart or pointerdown', rawNavigationHandlers.length === 0]);

const failed = checks.filter(([, ok]) => !ok);

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
}

if (rawNavigationHandlers.length > 0) {
  console.error('\nUnsafe handlers found:');
  for (const handler of rawNavigationHandlers) {
    console.error(`- ${handler}`);
  }
}

if (failed.length > 0) {
  console.error(`\n${failed.length} mobile click/scroll guard validation check(s) failed.`);
  Deno.exit(1);
}

console.log('\nMobile click/scroll guard validation passed.');

export {};
