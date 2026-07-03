import { describe, expect, it, vi } from 'vitest';

async function loadUrlModule(apiBaseUrl?: string) {
  vi.resetModules();
  vi.doMock('@app/lib/env', () => ({
    clientEnv: {
      apiBaseUrl,
      turnstileSiteKey: undefined,
    },
  }));

  return import('./url');
}

describe('api url helpers', () => {
  it('keeps relative api urls when no api base url is configured', async () => {
    const { resolveApiUrl } = await loadUrlModule();

    expect(resolveApiUrl('/api/player/state')).toBe('/api/player/state');
    expect(resolveApiUrl('/assets/app.js')).toBe('/assets/app.js');
  });

  it('resolves api urls against the configured api base url', async () => {
    const { resolveApiUrl } = await loadUrlModule('https://api.example.com');

    expect(resolveApiUrl('/api/player/state')).toBe(
      'https://api.example.com/api/player/state',
    );
  });

  it('derives websocket urls from the configured api base url', async () => {
    const { resolveRealtimeUrl } = await loadUrlModule('https://api.example.com');

    expect(resolveRealtimeUrl()).toBe('wss://api.example.com/api/realtime');
    expect(resolveRealtimeUrl(['world-chat', 'player-state'])).toBe(
      'wss://api.example.com/api/realtime?channels=world-chat%2Cplayer-state',
    );
  });
});
