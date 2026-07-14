export type SectAction = (url: string, init: RequestInit) => Promise<void>;

export const sectJsonRequest = (
  method: string,
  body?: unknown,
): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
