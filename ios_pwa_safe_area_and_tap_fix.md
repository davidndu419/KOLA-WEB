# iOS PWA Safe Area and Tap Fix

## What Changed

- Root layout now mounts `PWAEnvironment`, which tags `<html>` with `ios-device` and `pwa-standalone` when the installed iOS PWA is running.
- Global CSS now exposes safe-area variables and utilities for top, bottom, left, and right insets.
- The authenticated app shell uses a real safe-area top spacer, `100dvh`, contained mobile scrolling, and extra iOS standalone breathing room.
- Bottom navigation now uses safe-area bottom padding so it clears the iOS home indicator.
- `Touchable` now routes taps through `useIntentionalTap`, which rejects scroll gestures, long presses, and post-scroll momentum before firing an action.
- Bottom navigation uses guarded `Touchable` presses instead of raw link taps.

## Covered Surfaces

- Mobile dashboard top balance area
- Services, sales, stock, and expense top screens
- Bottom tab navigation
- Quick action icons
- Transaction history rows
- Product/stock rows
- Floating action buttons

## Validation

Run:

```bash
deno run --allow-read src/scripts/validate_ios_pwa_safe_area.ts
deno run --allow-read src/scripts/validate_ios_intentional_tap.ts
deno run --allow-read src/scripts/validate_mobile_click_scroll_guard.ts
```

Manual iPhone 14 Pro PWA checks should confirm that content clears the Dynamic Island/status bar, the bottom nav clears the home indicator, and scrolling over icons or rows no longer opens them accidentally.
