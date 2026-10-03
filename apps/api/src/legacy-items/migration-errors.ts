import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { InventoryError } from '@server/inventory/operations.js';
import { InventoryRuleError } from '@daoyou/shared/inventory';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

export function migrationErrors(kind: 'manual' | 'artifact') {
  return apiErrorFilter((error) => {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (error instanceof ZodError)
      return Response.json(
        { success: false, error: '兑换参数无效' },
        { status: 400 },
      );
    if (error instanceof InventoryError || error instanceof InventoryRuleError)
      return Response.json(
        { success: false, error: error.message },
        { status: 409 },
      );
    console.error(`[${kind}-migration]`, error);
    return Response.json(
      {
        success: false,
        error: `结果暂未确认，请刷新旧${kind === 'manual' ? '功法' : '法宝'}列表并核对背包`,
      },
      { status: 500 },
    );
  });
}
