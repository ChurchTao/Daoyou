export class CombatV6RequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export async function combatV6Request<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const body = (await response.json().catch(() => ({
    error: '战斗服务暂时不可用，请稍后刷新重试',
  }))) as {
    success?: boolean;
    data?: T;
    error?: string;
    code?: string;
  };
  if (!response.ok || body.success !== true)
    throw new CombatV6RequestError(
      body.error ?? `请求失败（${response.status}）`,
      body.code,
      response.status,
    );
  return body.data as T;
}
export function mutationBody(body: unknown, method = 'POST'): RequestInit {
  return { method, body: JSON.stringify(body) };
}
