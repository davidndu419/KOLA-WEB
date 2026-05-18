import { safeTime } from '@/lib/utils';

export const MODIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MODIFICATION_WINDOW_ERROR = 'This transaction can no longer be modified after 24 hours.';

export function isWithinModificationWindow(created_at: Date | string | number | undefined | null): boolean {
  const createdAt = safeTime(created_at);
  if (!createdAt) return false;
  return Date.now() - createdAt < MODIFICATION_WINDOW_MS;
}

export function assertWithinModificationWindow(created_at: Date | string | number | undefined | null) {
  if (!isWithinModificationWindow(created_at)) {
    throw new Error(MODIFICATION_WINDOW_ERROR);
  }
}
