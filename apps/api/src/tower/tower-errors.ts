import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { InventoryError } from '@server/inventory/operations.js';
import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import { TowerV6Error } from '@server/tower/application/runtime/combatV6.js';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

function towerError(error: unknown): Response {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof ZodError)
    return Response.json({ error: '幻境请求参数无效' }, { status: 400 });
  if (
    error instanceof TowerV6Error ||
    error instanceof InventoryError ||
    error instanceof CombatV6BuildError
  )
    return Response.json({ error: error.message }, { status: 409 });
  console.error('[tower-v6] request failed', error);
  return Response.json(
    { error: '幻境操作失败，请刷新后重试' },
    { status: 500 },
  );
}

export const TowerErrors = apiErrorFilter(towerError);
