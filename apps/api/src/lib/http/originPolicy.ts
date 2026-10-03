import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import { isAllowedPublicWebOrigin, normalizeOrigin } from './origins.js';

function getApiSelfOrigin() {
  return normalizeOrigin(getRuntimeEnvironment().BETTER_AUTH_URL);
}

export function isAllowedWriteOrigin(origin: string | undefined | null) {
  if (!origin) {
    return true;
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  const selfOrigin = getApiSelfOrigin();
  return normalized === selfOrigin || isAllowedPublicWebOrigin(normalized);
}
