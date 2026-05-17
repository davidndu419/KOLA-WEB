import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeTime(value: unknown): number {
  if (!value) return 0;
  const time = value instanceof Date
    ? value.getTime()
    : new Date(value as string | number | Date).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  const diffMs = Date.now() - safeTime(d);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString('en-NG', { 
    month: 'short', 
    day: 'numeric' 
  });
}
