declare const Deno: {
  readTextFile(path: string): Promise<string>;
  exit(code?: number): never;
};

const hook = await Deno.readTextFile('src/hooks/use-intentional-tap.ts');
const touchable = await Deno.readTextFile('src/components/touchable.tsx');

const checks: Array<[string, boolean]> = [
  ['hook exports TAP_MOVE_THRESHOLD = 10', hook.includes('export const TAP_MOVE_THRESHOLD = 10')],
  ['hook exports TAP_MAX_DURATION = 500', hook.includes('export const TAP_MAX_DURATION = 500')],
  ['hook records touch start coordinates', hook.includes('startX: touch.clientX') && hook.includes('startY: touch.clientY')],
  ['hook measures movement with Math.hypot', hook.includes('Math.hypot(dx, dy)')],
  ['hook rejects touches above movement threshold', hook.includes('distance <= TAP_MOVE_THRESHOLD')],
  ['hook rejects long presses above max duration', hook.includes('duration <= TAP_MAX_DURATION')],
  ['hook rejects taps during scroll momentum', hook.includes('SCROLL_MOMENTUM_MS') && hook.includes('duringMomentum')],
  ['hook suppresses synthetic click after touch', hook.includes('CLICK_SUPPRESS_MS') && hook.includes('suppressClickUntilRef')],
  ['Touchable uses useIntentionalTap', touchable.includes('useIntentionalTap(handleTap')],
  ['Touchable no longer relies on Framer onTap navigation', !touchable.includes('onTap={handleTap}')]
];

const failed = checks.filter(([, ok]) => !ok);

for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} intentional tap validation check(s) failed.`);
  Deno.exit(1);
}

console.log('\niOS intentional tap validation passed.');

export {};
