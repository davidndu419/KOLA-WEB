'use client';

export function showToast(message: string) {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent('kola:toast', { detail: { message } }));
}
