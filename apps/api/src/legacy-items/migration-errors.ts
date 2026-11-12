import { InventoryRuleError } from '@daoyou/game-domain/inventory';
import { InventoryError } from '@server/inventory/operations.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

export function migrationErrors(kind: 'manual' | 'artifact' | 'seed') {
  return apiErrorFilter((error) => {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (error instanceof ZodError)
      return Response.json(
        { success: false, error: '兑换参数无效' },
        { status: 400 },
      );
    if (
      error instanceof InventoryError ||
      error instanceof InventoryRuleError ||
      error instanceof PlayerCommandIdempotencyError
    )
      return Response.json(
        { success: false, error: error.message },
        { status: 409 },
      );
    console.error(`[${kind}-migration]`, error);
    return Response.json(
      {
        success: false,
        error: `结果暂未确认，请刷新旧${kind === 'manual' ? '功法' : kind === 'seed' ? '灵种' : '法宝'}列表并核对背包`,
      },
      { status: 500 },
    );
  });
}
