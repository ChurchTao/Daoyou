import { authClient } from '@app/lib/auth/client';
import type { AuthLoaderData, UserLoaderData } from '@app/lib/router/routeData';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authLayoutLoader,
  guestOnlyLoader,
  indexRedirectLoader,
  requireAdminLoader,
  requireUserLoader,
} from './loaders';

vi.mock('@app/lib/auth/client', async () => {
  const actual = await vi.importActual<typeof import('@app/lib/auth/client')>(
    '@app/lib/auth/client',
  );

  return {
    ...actual,
    authClient: {
      ...actual.authClient,
      getSession: vi.fn(),
    },
  };
});

function createRequest(url: string) {
  return new Request(url);
}

function createSessionPayload(authenticated: boolean) {
  return authenticated
    ? {
        data: {
          session: { id: 'session-1' },
          user: { id: 'user-1', email: 'dao@example.com' },
        },
        error: null,
      }
    : {
        data: null,
        error: {
          message: 'Unauthorized',
          status: 401,
          statusText: 'Unauthorized',
        },
      };
}

describe('router loaders', () => {
  const getSessionMock = vi.mocked(authClient.getSession);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects index to /game when the user is authenticated', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(true) as never);

    const response = await indexRedirectLoader({
      request: createRequest('http://localhost/'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/game');
  });

  it('redirects index to /login when the user is not authenticated', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(false) as never);

    const response = await indexRedirectLoader({
      request: createRequest('http://localhost/'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/login');
  });

  it('redirects guest-only pages to /game when already authenticated', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(true) as never);

    const response = await guestOnlyLoader({
      request: createRequest('http://localhost/login'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/game');
  });

  it('redirects auth layout to /game when already authenticated', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(true) as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await authLayoutLoader({
      request: createRequest('http://localhost/login'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/game');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns announcement loader data for guest auth pages', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(false) as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            announcement: '今晚 23:00 维护，请提前下线。',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const response = await authLayoutLoader({
      request: createRequest('http://localhost/login'),
      params: {},
      context: undefined,
    });

    expect(response).toEqual({
      announcement: '今晚 23:00 维护，请提前下线。',
    } satisfies AuthLoaderData);
  });

  it('falls back to a null announcement when auth announcement loading fails', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(false) as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: '公告配置暂不可用，请稍后重试',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const response = await authLayoutLoader({
      request: createRequest('http://localhost/login'),
      params: {},
      context: undefined,
    });

    expect(response).toEqual({
      announcement: null,
    } satisfies AuthLoaderData);
  });

  it('redirects protected routes to /login when unauthenticated', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(false) as never);

    const response = await requireUserLoader({
      request: createRequest('http://localhost/game'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/login');
  });

  it('returns the authenticated user id for protected routes', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(true) as never);

    const response = await requireUserLoader({
      request: createRequest('http://localhost/game'),
      params: {},
      context: undefined,
    });

    expect(response).toEqual({
      userId: 'user-1',
    } satisfies UserLoaderData);
  });

  it('redirects admin routes to /login when unauthenticated', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(false) as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await requireAdminLoader({
      request: createRequest('http://localhost/admin'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects admin routes to /game when the user is forbidden', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(true) as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await requireAdminLoader({
      request: createRequest('http://localhost/admin'),
      params: {},
      context: undefined,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe('/game');
  });

  it('returns admin loader data when the user is authorized', async () => {
    getSessionMock.mockResolvedValue(createSessionPayload(true) as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ email: 'admin@example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await requireAdminLoader({
      request: createRequest('http://localhost/admin'),
      params: {},
      context: undefined,
    });

    expect(response).toEqual({ adminEmail: 'admin@example.com' });
  });
});
