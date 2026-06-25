'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

export const TAP_MOVE_THRESHOLD = 10;
export const TAP_MAX_DURATION = 500;

const CLICK_SUPPRESS_MS = 700;
const SCROLL_MOMENTUM_MS = 160;

let lastScrollAt = 0;
let scrollListenerCount = 0;

function markScroll() {
  lastScrollAt = Date.now();
}

interface IntentionalTapOptions {
  disabled?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onCancel?: () => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
  active: boolean;
}

export function useIntentionalTap(
  onTap?: () => void,
  { disabled, onStart, onEnd, onCancel }: IntentionalTapOptions = {}
) {
  const touchRef = useRef<TouchState | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (scrollListenerCount === 0) {
      window.addEventListener('scroll', markScroll, true);
    }

    scrollListenerCount += 1;

    return () => {
      scrollListenerCount -= 1;
      if (scrollListenerCount === 0) {
        window.removeEventListener('scroll', markScroll, true);
      }
    };
  }, []);

  const suppressClick = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
  }, []);

  const cancelTouch = useCallback(() => {
    if (touchRef.current?.active) {
      onCancel?.();
    }
    touchRef.current = null;
    
    const isIOS = typeof window !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    if (isIOS) {
      suppressClick();
    }
  }, [onCancel, suppressClick]);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (disabled || event.touches.length !== 1) return;

    const touch = event.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      moved: false,
      active: true,
    };
    onStart?.();
  }, [disabled, onStart]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const state = touchRef.current;
    if (!state || disabled || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    const distance = Math.hypot(dx, dy);

    if (distance > TAP_MOVE_THRESHOLD) {
      state.moved = true;
      onCancel?.();
    }
  }, [disabled, onCancel]);

  const onTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
    const state = touchRef.current;
    if (!state || disabled) return;

    const touch = event.changedTouches[0];
    const dx = touch ? touch.clientX - state.startX : 0;
    const dy = touch ? touch.clientY - state.startY : 0;
    const distance = Math.hypot(dx, dy);
    const duration = Date.now() - state.startTime;
    
    // Correctly calculate momentum relative to touch start to avoid layout shift scroll events swallowing tap
    const duringMomentum = lastScrollAt < state.startTime && (state.startTime - lastScrollAt) < SCROLL_MOMENTUM_MS;
    
    const isIntentional =
      !state.moved &&
      distance <= TAP_MOVE_THRESHOLD &&
      duration <= TAP_MAX_DURATION &&
      !duringMomentum;

    touchRef.current = null;
    onEnd?.();

    const isIOS = typeof window !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    if (!isIOS) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useIntentionalTap] Non-iOS device. Letting click event handle action.`);
      }
      return;
    }

    if (!isIntentional) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useIntentionalTap] Touch rejected: moved=${state.moved}, distance=${distance.toFixed(1)}, duration=${duration}ms, duringMomentum=${duringMomentum}. Falling back to click.`);
      }
      // Do not suppress click or prevent default, allow native fallback click
      return;
    }

    suppressClick();
    event.preventDefault(); // Prevent native click since we handled it
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useIntentionalTap] Touch intentional. Triggering tap.`);
    }
    onTap?.();
  }, [disabled, onEnd, onTap, suppressClick]);

  const onTouchCancel = useCallback(() => {
    cancelTouch();
  }, [cancelTouch]);

  const onClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onTap?.();
  }, [disabled, onTap]);

  return {
    onClick,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
}
