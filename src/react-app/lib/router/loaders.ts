import { authClient } from '@app/lib/auth/client';
import { replace, type LoaderFunctionArgs } from 'react-router';

type SessionResult = Awaited<ReturnType<typeof authClient.getSession>>;
type SessionData = SessionResult['data'];

type AdminSessionResponse = {
  success?: boolean;
  email?: string;
  error?: string;
};

export interface AdminLoaderData {
  adminEmail: string;
}

async function hasAuthenticatedUser(request: Request) {
  const session = await resolveSessionData(request);

  return Boolean(session?.user);
}

async function resolveSessionData(
  request: Request,
): Promise<SessionData | null> {
  try {
    const result = await authClient.getSession({
      fetchOptions: {
        cache: 'no-store',
        signal: request.signal,
      },
    });

    return result.data ?? null;
  } catch {
    return null;
  }
}

export async function indexRedirectLoader({ request }: LoaderFunctionArgs) {
  const session = await resolveSessionData(request);

  return session?.user ? replace('/game') : replace('/login');
}

export async function guestOnlyLoader({ request }: LoaderFunctionArgs) {
  return (await hasAuthenticatedUser(request)) ? replace('/game') : null;
}

export async function requireUserLoader({ request }: LoaderFunctionArgs) {
  return (await hasAuthenticatedUser(request)) ? null : replace('/login');
}

export async function requireAdminLoader({
  request,
}: LoaderFunctionArgs): Promise<AdminLoaderData | Response> {
  if (!(await hasAuthenticatedUser(request))) {
    return replace('/login');
  }

  const response = await fetch('/api/admin/session', {
    cache: 'no-store',
    credentials: 'same-origin',
    signal: request.signal,
  });
  const payload = (await response.json()) as AdminSessionResponse;

  if (response.status === 401) {
    return replace('/login');
  }

  if (response.status === 403) {
    return replace('/game');
  }

  if (!response.ok || !payload.email) {
    throw new Error(payload.error ?? '加载管理员会话失败');
  }

  return {
    adminEmail: payload.email,
  };
}
