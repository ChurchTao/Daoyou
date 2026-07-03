import { isAllowedPublicWebOrigin } from './origins';

export function isAllowedRealtimeOrigin(origin: string | undefined | null) {
  return isAllowedPublicWebOrigin(origin);
}
