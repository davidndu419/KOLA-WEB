export const INVALID_USER_IDENTIFIER_ERROR = 'Invalid user identifier';

export const LEGACY_USER_PLACEHOLDER_IDS = [
  'local_user',
  'local-user',
  'guest_user',
  'offline_user',
  'default_user',
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if ((LEGACY_USER_PLACEHOLDER_IDS as readonly string[]).includes(normalized)) return false;

  return UUID_PATTERN.test(normalized);
}
