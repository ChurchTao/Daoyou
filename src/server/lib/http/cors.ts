import { resolveCorsOrigin } from './origins';

export const apiCorsOptions = {
  origin: resolveCorsOrigin,
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'x-altcha-payload',
    'x-llm-api-key',
    'x-llm-model',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 600,
};
