import { resolveCorsOrigin } from './origins';

export const apiCorsOptions = {
  origin: resolveCorsOrigin,
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'x-turnstile-token',
    'x-llm-provider',
    'x-llm-api-key',
    'x-llm-base-url',
    'x-llm-model',
    'x-llm-fast-model',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 600,
};
