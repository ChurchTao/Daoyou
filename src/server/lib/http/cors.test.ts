import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { afterEach, describe, expect, it } from 'vitest';
import { apiCorsOptions } from './cors';

const originalOrigins = process.env.PUBLIC_WEB_ORIGINS;

afterEach(() => {
  process.env.PUBLIC_WEB_ORIGINS = originalOrigins;
});

function createCorsProbeApp() {
  const app = new Hono();
  app.use('/api/*', cors(apiCorsOptions));
  app.get('/api/probe', (c) => c.json({ success: true }));
  return app;
}

describe('api CORS options', () => {
  it('allows configured origins with credentials', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    const response = await createCorsProbeApp().request('/api/probe', {
      headers: { Origin: 'https://app.example.com' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.com',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
  });

  it('does not echo unconfigured origins', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    const response = await createCorsProbeApp().request('/api/probe', {
      headers: { Origin: 'https://evil.example.com' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('responds to preflight requests', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    const response = await createCorsProbeApp().request('/api/probe', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-turnstile-token,x-llm-provider',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.com',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
  });
});
