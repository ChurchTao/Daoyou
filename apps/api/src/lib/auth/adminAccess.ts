import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
function parseCommaSeparatedEnv(name: 'ADMIN_EMAILS' | 'ADMIN_USER_IDS') {
  return (getRuntimeEnvironment()[name] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminUserIds(): string[] {
  return parseCommaSeparatedEnv('ADMIN_USER_IDS');
}

export function isAdminUserId(userId?: string | null): boolean {
  if (!userId) return false;
  return getAdminUserIds().includes(userId.toLowerCase());
}

export function isLegacyAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return parseCommaSeparatedEnv('ADMIN_EMAILS').includes(email.toLowerCase());
}

export function isAdminIdentity(user?: {
  id?: string | null;
  email?: string | null;
}): boolean {
  return isAdminUserId(user?.id) || isLegacyAdminEmail(user?.email);
}
