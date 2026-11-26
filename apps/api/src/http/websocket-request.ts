import { apiCorsOptions } from '@server/lib/http/cors.js';

export type HandshakeError = {
  status: number;
  message: string;
  headers?: Headers;
  body?: { error: string };
};

/** Upgrade requests bypass Express CORS middleware. */
export function webSocketResponseHeaders(headers: Headers): Headers {
  const responseHeaders = new Headers({
    Vary: 'Origin',
    'Access-Control-Allow-Credentials': 'true',
  });
  const origin = apiCorsOptions.origin(headers.get('origin') ?? '');
  if (origin) responseHeaders.set('Access-Control-Allow-Origin', origin);
  return responseHeaders;
}
