import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';

const originalOrigins = process.env.PUBLIC_WEB_ORIGINS;

afterEach(() => {
  process.env.PUBLIC_WEB_ORIGINS = originalOrigins;
});

describe('realtime origin guard', () => {
  it('allows configured public web origins', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedRealtimeOrigin('https://app.example.com')).toBe(true);
  });

  it('rejects browser websocket origins outside the allowlist', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedRealtimeOrigin('https://evil.example.com')).toBe(false);
  });

  it('allows missing origin for non-browser probes', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedRealtimeOrigin(undefined)).toBe(true);
  });
});
