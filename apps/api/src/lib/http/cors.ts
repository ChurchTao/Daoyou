import { resolveCorsOrigin } from './origins.js';

export const apiCorsOptions = {
  origin: resolveCorsOrigin,
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'x-altcha-payload',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 600,
};
