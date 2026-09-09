import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './types';

/** Retired clients receive a clear response before cooldown or persistence. */
export const rejectRetiredBattleShare: MiddlewareHandler<AppEnv> = async (c, next) => {
  const body = await c.req.json().catch(() => undefined);
  if (body?.messageType === 'battle_showcase') {
    return c.json({ success: false, error: '旧版战报分享已停用' }, 410);
  }
  await next();
};
