import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { unsafeRequestOriginGuard } from './originGuard';

const originalOrigins = process.env.PUBLIC_WEB_ORIGINS;
const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;

afterEach(() => {
  process.env.PUBLIC_WEB_ORIGINS = originalOrigins;
  process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
});

function createProbeApp() {
  const app = new Hono();
  app.use('/api/*', unsafeRequestOriginGuard());
  app.post('/api/probe', (c) => c.json({ success: true }));
  app.get('/api/probe', (c) => c.json({ success: true }));
  return app;
}

describe('unsafeRequestOriginGuard', () => {
  it('allows configured web origins for unsafe methods', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    const response = await createProbeApp().request('/api/probe', {
      method: 'POST',
      headers: { Origin: 'https://app.example.com' },
    });

    expect(response.status).toBe(200);
  });

  it('rejects cross-site unsafe requests', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    const response = await createProbeApp().request('/api/probe', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example.com',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    expect(response.status).toBe(403);
  });

  it('allows non-browser unsafe requests without origin', async () => {
    const response = await createProbeApp().request('/api/probe', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
  });
});
