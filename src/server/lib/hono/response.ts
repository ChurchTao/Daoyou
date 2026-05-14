import type { AppEnv } from '@server/lib/hono/types';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function jsonWithStatus<T>(
  context: Context<AppEnv>,
  body: T,
  status: number,
) {
  context.status(status as ContentfulStatusCode);
  return context.json(body);
}
