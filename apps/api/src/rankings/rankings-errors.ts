import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { InventoryError } from '@server/inventory/operations.js';
import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import { RankingV6Error } from '@server/combat/application/CombatV6RankingService.js';
import { z } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

export const RankingListErrors = apiErrorFilter((error, config) => {
  console.error('获取排行榜 API 错误:', error);
  return Response.json(
    {
      error:
        config.get('NODE_ENV') === 'development' && error instanceof Error
          ? error.message
          : '获取排行榜失败，请稍后重试',
    },
    { status: 500 },
  );
});
export const ItemRankingErrors = apiErrorFilter((error) => {
  console.error('获取排行榜失败:', error);
  return Response.json(
    { success: false, error: '获取排行榜失败' },
    { status: 500 },
  );
});
export const WealthRankingErrors = apiErrorFilter((error) => {
  console.error('获取财富榜失败:', error);
  return Response.json(
    { success: false, error: '获取财富榜失败' },
    { status: 500 },
  );
});
export const RankingProbeErrors = apiErrorFilter((error, config) => {
  console.error('神识查探错误:', error);
  const message =
    config.get('NODE_ENV') === 'development'
      ? error instanceof Error
        ? error.message
        : '神识查探失败'
      : '神识查探失败，请稍后重试';
  return Response.json({ error: message }, { status: 500 });
});
export const RankingChallengeErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '挑战参数无效' },
      { status: 400 },
    );
  if (error instanceof InventoryError)
    return Response.json(
      { success: false, error: '请先结束当前战斗与结算，再发起天骄榜挑战' },
      { status: 409 },
    );
  if (error instanceof RankingV6Error || error instanceof CombatV6BuildError)
    return Response.json(
      { success: false, error: error.message },
      { status: 409 },
    );
  console.error('[ranking-v6] challenge failed', error);
  return Response.json(
    { success: false, error: '挑战尚未完成，请使用原请求重试恢复' },
    { status: 500 },
  );
});
