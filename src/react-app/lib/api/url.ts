import { clientEnv } from '@app/lib/env';
import type { RealtimeChannel } from '@shared/contracts/realtime';

export function resolveApiUrl(input: string) {
  if (!input.startsWith('/api/')) {
    return input;
  }

  if (!clientEnv.apiBaseUrl) {
    return input;
  }

  return `${clientEnv.apiBaseUrl}${input}`;
}

export function resolveRealtimeUrl(channels?: RealtimeChannel[]) {
  const channelQuery = channels?.length
    ? `?channels=${encodeURIComponent(channels.join(','))}`
    : '';

  return resolveApiWebSocketUrl(`/api/realtime${channelQuery}`);
}

export function resolveApiWebSocketUrl(path: string) {
  const resolved = resolveApiUrl(path);
  if (!clientEnv.apiBaseUrl && typeof window === 'undefined') return resolved;

  const url = new URL(
    resolved,
    typeof window === 'undefined' ? undefined : window.location.href,
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
