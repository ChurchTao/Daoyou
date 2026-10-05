import { DungeonFlowError } from '@server/dungeon/application/flow/DungeonFlowService.js';
import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { DungeonStartError } from '@server/dungeon/application/DungeonApplicationService.js';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/cultivator/application/QiService.js';
import { ZodError } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBodyParseError } from '../http/json-body.js';

function flowError(error: unknown): Response | undefined {
  return (
    redisLockErrorResponse(error) ??
    (error instanceof DungeonFlowError || error instanceof CombatV6BuildError
      ? Response.json(
          { error: error.message, code: error.code },
          { status: error.status },
        )
      : undefined)
  );
}

export const DungeonStartErrors = apiErrorFilter((error) => {
  const flow = flowError(error);
  if (flow) return flow;
  if (error instanceof DungeonStartError)
    return Response.json(
      {
        error: error.message,
        ...(error.readiness ? { readiness: error.readiness } : {}),
      },
      { status: error.status },
    );
  if (error instanceof QiInsufficientError)
    return Response.json(
      {
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      { status: 409 },
    );
  if (error instanceof QiServiceError)
    return Response.json({ error: error.message }, { status: error.status });
});

export const DungeonActionErrors = apiErrorFilter((error) => {
  const flow = flowError(error);
  if (flow) return flow;
  if (error instanceof ZodError)
    return Response.json(
      { error: '探索请求无效，请刷新后重试' },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : '副本推进失败';
  const status =
    error instanceof DungeonStartError ||
    /不足|没有符合条件|资源消耗失败|所选物品|提交的材料|提交数量|选择需要提交/.test(
      message,
    )
      ? 409
      : 500;
  return Response.json({ error: message }, { status });
});

function recoveryErrors(fallback: string) {
  return apiErrorFilter(
    (error) =>
      flowError(error) ??
      Response.json(
        {
          error: error instanceof Error ? error.message : fallback,
        },
        {
          status:
            error instanceof ZodError
              ? 400
              : error instanceof DungeonStartError
                ? 409
                : 500,
        },
      ),
  );
}

export const DungeonRecoverErrors = recoveryErrors('副本恢复失败');
export const DungeonContinueErrors = recoveryErrors('副本推进失败');
export const DungeonEscapeErrors = recoveryErrors('副本结算失败');

export const DungeonQuitErrors = apiErrorFilter(
  (error) =>
    flowError(error) ??
    (error instanceof DungeonStartError
      ? Response.json({ error: error.message }, { status: 409 })
      : undefined),
);

export const DungeonBeginErrors = apiErrorFilter(
  (error) =>
    redisLockErrorResponse(error) ??
    (error instanceof DungeonFlowError
      ? Response.json({ error: error.message }, { status: 409 })
      : undefined),
);

export const DungeonCompleteErrors = apiErrorFilter((error) => {
  const flow = flowError(error);
  if (flow) return flow;
  const message = error instanceof Error ? error.message : '遭遇战执行失败';
  return Response.json(
    { error: message },
    { status: /遭遇战|修真者/.test(message) ? 404 : 500 },
  );
});

function battleCommandErrors(fallback: string) {
  return apiErrorFilter((error) => {
    // Body parsing precedes the original command handler's catch block.
    if (error instanceof JsonBodyParseError) return undefined;
    return Response.json(
      { error: error instanceof Error ? error.message : fallback },
      { status: 409 },
    );
  });
}

export const DungeonSubmitErrors = battleCommandErrors('提交失败');
export const DungeonResolveErrors = battleCommandErrors('结算失败');
