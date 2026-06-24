declare const Deno: {
  readTextFile(path: string): Promise<string>;
  exit(code?: number): never;
};

const checks: Array<[string, boolean]> = [];

async function read(path: string) {
  return await Deno.readTextFile(path);
}

const layout = await read('src/app/layout.tsx');
const appLayout = await read('src/app/(app)/layout.tsx');
const globals = await read('src/app/globals.css');
const bottomNav = await read('src/components/bottom-navigation.tsx');
const dashboard = await read('src/app/(app)/dashboard/page.tsx');
const services = await read('src/app/(app)/service/page.tsx');

checks.push(
  ['viewport-fit=cover is configured through Next viewport metadata', layout.includes('viewportFit: "cover"')],
  ['PWAEnvironment is mounted at the root', layout.includes('<PWAEnvironment />')],
  ['global safe-area CSS variables exist', ['--safe-top', '--safe-bottom', '--safe-left', '--safe-right'].every((token) => globals.includes(token))],
  ['safe-area utility classes exist', ['.safe-top', '.safe-bottom', '.pwa-page', '.mobile-scroll'].every((token) => globals.includes(token))],
  ['iOS standalone top spacing is targeted', globals.includes('.ios-device.pwa-standalone .mobile-page .safe-top-spacer')],
  ['app shell uses mobile-page and pwa-page classes', appLayout.includes('mobile-page pwa-page')],
  ['app shell uses safe top spacer', appLayout.includes('safe-top-spacer')],
  ['app scroll container uses momentum scrolling utility', appLayout.includes('mobile-scroll')],
  ['bottom navigation clears safe-area bottom', bottomNav.includes('safe-bottom bottom-navigation')],
  ['dashboard top area is identifiable for standalone breathing room', dashboard.includes('dashboard-page')],
  ['services page header is identifiable for safe-area audit', services.includes('screen-header')]
);

const failed = checks.filter(([, ok]) => !ok);

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} iOS PWA safe-area validation check(s) failed.`);
  Deno.exit(1);
}

console.log('\niOS PWA safe-area validation passed.');

export {};
