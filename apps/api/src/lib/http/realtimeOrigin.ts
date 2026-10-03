import { isAllowedPublicWebOrigin } from './origins.js';

export function isAllowedRealtimeOrigin(origin: string | undefined | null) {
  return isAllowedPublicWebOrigin(origin);
}
