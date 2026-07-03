import { clientEnv } from '@app/lib/env';

export function resolveApiUrl(input: string) {
  if (!input.startsWith('/api/')) {
    return input;
  }

  if (!clientEnv.apiBaseUrl) {
    return input;
  }

  return `${clientEnv.apiBaseUrl}${input}`;
}

export function resolveRealtimeUrl() {
  if (clientEnv.apiBaseUrl) {
    const apiUrl = new URL(clientEnv.apiBaseUrl);
    apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    apiUrl.pathname = '/api/realtime';
    apiUrl.search = '';
    apiUrl.hash = '';
    return apiUrl.toString();
  }

  if (typeof window === 'undefined') {
    return '/api/realtime';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/realtime`;
}
