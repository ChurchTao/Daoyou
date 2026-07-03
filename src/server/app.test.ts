import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

function passThroughMiddleware(): MiddlewareHandler {
  return async (_context, next) => {
    await next();
  };
}

vi.mock('@server/lib/auth/hono', () => ({
  handleAuthRequest: vi.fn((context) => context.json({ success: true })),
}));

vi.mock('@server/lib/http/context', () => ({
  runWithContext: async (_context: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('@server/lib/http/originGuard', () => ({
  unsafeRequestOriginGuard: passThroughMiddleware,
}));

vi.mock('@server/lib/hono/apiIpRateLimit', () => ({
  apiIpRateLimit: passThroughMiddleware,
}));

vi.mock('@server/lib/hono/middleware', () => ({
  jsonError: passThroughMiddleware,
}));

vi.mock('@server/lib/llm/allowedHosts', () => ({
  validateLlmBaseUrl: (baseUrl: string) => baseUrl,
}));

vi.mock('@server/routes/api', async () => {
  const { Hono } = await vi.importActual<typeof import('hono')>('hono');
  return {
    default: new Hono().get('/known', (context) =>
      context.json({ success: true }),
    ),
  };
});

vi.mock('@server/routes/internal', async () => {
  const { Hono } = await vi.importActual<typeof import('hono')>('hono');
  return {
    default: new Hono().get('/known', (context) =>
      context.json({ success: true }),
    ),
  };
});

describe('server app fallback', () => {
  it('redirects unregistered top-level routes to the official site', async () => {
    const { default: app } = await import('@server/app');

    const response = await app.request('/missing-route');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://daoyou.org');
  });

  it('redirects unregistered API routes to the official site', async () => {
    const { default: app } = await import('@server/app');

    const response = await app.request('/api/missing-route');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://daoyou.org');
  });
});
