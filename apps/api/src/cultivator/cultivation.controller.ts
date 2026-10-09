import {
  Controller,
  HttpCode,
  Inject,
  Req,
  RequestMethod,
  Sse,
  SseSignal,
  UseFilters,
  type MessageEvent,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { JournalIdempotencyError } from '@server/lib/repositories/playerJournalRepository.js';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/cultivator/application/QiService.js';
import { RetreatCommandError } from '@server/cultivator/application/RetreatApplicationService.js';
import { YieldCommandError } from '@server/cultivator/application/YieldApplicationService.js';
import { JournalRequestSchema } from '@daoyou/contracts/player/journal';
import {
  RetreatRequestSchema,
  type RetreatRequest,
} from '@daoyou/contracts/retreat';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import type { GameRequest } from '../http/request.js';
import { SseResponseService } from '../http/sse-response.service.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { RetreatService } from './retreat.service.js';
import { YieldService } from './yield.service.js';

const RetreatErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
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
  if (error instanceof JournalIdempotencyError)
    return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof RetreatCommandError)
    return Response.json(
      { success: false, error: error.message, ...error.payload },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return Response.json({ error: '闭关突破参数无效' }, { status: 400 });
  console.error('闭关突破请求失败:', error);
  return Response.json({ error: '闭关突破暂时无法完成' }, { status: 500 });
});

const YieldErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof YieldCommandError)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  console.error('历练请求失败:', error);
  return Response.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 },
  );
});

// `/api/cultivator/*` stays until the Pages build that calls `/api/stream` is deployed.
@Controller(['api/cultivator', 'api/stream/cultivator'])
@Access('active')
export class CultivationController {
  constructor(
    @Inject(RetreatService) private readonly retreat: RetreatService,
    @Inject(YieldService) private readonly yields: YieldService,
    @Inject(SseResponseService) private readonly sse: SseResponseService,
  ) {}

  @Sse('retreat', { method: RequestMethod.POST })
  @HttpCode(200)
  @UseFilters(RetreatErrors)
  cultivate(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(RetreatRequestSchema))
    input: RetreatRequest,
    @SseSignal() signal: AbortSignal,
    @Req() request: GameRequest,
  ): Promise<Observable<MessageEvent>> {
    return this.sse.stream(request, signal, async (streamSignal) => {
      const execution = await this.retreat.execute(actor, input);
      if (streamSignal.aborted) return async () => undefined;
      return (emit, nextSignal) =>
        this.retreat.stream(execution, nextSignal, emit);
    });
  }

  @Sse('yield', { method: RequestMethod.POST })
  @HttpCode(200)
  @UseFilters(YieldErrors)
  claimYield(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(JournalRequestSchema, 'legacy-unhandled'),
    )
    input: z.infer<typeof JournalRequestSchema>,
    @SseSignal() signal: AbortSignal,
    @Req() request: GameRequest,
  ): Promise<Observable<MessageEvent>> {
    return this.sse.stream(request, signal, async (streamSignal) => {
      const execution = await this.yields.execute(actor, input.requestId);
      if (streamSignal.aborted) return async () => undefined;
      return (emit, nextSignal) =>
        this.yields.stream(execution, nextSignal, emit);
    });
  }
}
