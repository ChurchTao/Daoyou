import { readStoredLlmConfig } from '../llmConfig';
import { resolveApiUrl } from './url';

/** Route API requests explicitly without changing browser or third-party fetch. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const source = input instanceof Request ? input.url : String(input);
  const original = new URL(source, window.location.href);
  const localApi =
    original.origin === window.location.origin &&
    original.pathname.startsWith('/api/');
  const target = localApi
    ? new URL(
        resolveApiUrl(`${original.pathname}${original.search}`),
        window.location.href,
      )
    : original;
  const api = new URL(resolveApiUrl('/api/'), window.location.href);
  if (
    target.origin !== api.origin ||
    !target.pathname.startsWith(api.pathname)
  ) {
    return fetch(input, init);
  }

  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  const config = readStoredLlmConfig();
  if (config) {
    headers.set('x-llm-provider', config.provider);
    headers.set('x-llm-api-key', config.apiKey);
    headers.set('x-llm-model', config.model);
  }
  const credentials =
    init?.credentials ??
    (input instanceof Request && input.credentials !== 'same-origin'
      ? input.credentials
      : 'include');
  if (input instanceof Request) {
    if (target.href === input.url) {
      return fetch(input, { ...init, credentials, headers });
    }
    const request = new Request(input, { ...init, credentials, headers });
    // Rebinding a Request URL through RequestInit turns its body into a stream.
    // Buffer only when routing to another API URL, preserving normal POST support.
    return fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body ? await request.arrayBuffer() : undefined,
      credentials: request.credentials,
      mode: request.mode,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      integrity: request.integrity,
      keepalive: request.keepalive,
      signal: request.signal,
    });
  }
  return fetch(target, { ...init, credentials, headers });
}
