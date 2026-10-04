import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { BlackMarketServiceError } from '@server/black-market/application/BlackMarketService.js';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/cultivator/application/QiService.js';
import type { Response as ExpressResponse } from 'express';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { JsonBody } from '../http/json-body.js';
import { withRequestAbort } from '../http/request-abort.js';
import { streamSseEvents } from '../http/sse.js';
import { ZodPipe } from '../http/zod.pipe.js';
import {
  CommitSchema,
  InteractSchema,
  LeaveSchema,
  OpenSessionSchema,
} from './black-market-input.js';
import { BlackMarketService } from './black-market.service.js';

const BlackMarketErrors = apiErrorFilter((error) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || '参数错误' },
      { status: 400 },
    );
  if (error instanceof BlackMarketServiceError)
    return Response.json({ error: error.message }, { status: error.status });
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
  console.error('black market api error:', error);
  return Response.json({ error: '黑市暂时闭门，请稍后再来' }, { status: 500 });
});

@Controller('api/black-market')
@Access('active')
@UseFilters(BlackMarketErrors)
export class BlackMarketController {
  constructor(
    @Inject(BlackMarketService) private readonly market: BlackMarketService,
  ) {}

  @Get(':nodeId')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
  ) {
    return this.market.read(actor, nodeId);
  }

  @Post(':nodeId/sessions')
  @HttpCode(200)
  open(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
    @JsonBody(new ZodPipe(OpenSessionSchema))
    input: z.infer<typeof OpenSessionSchema>,
  ) {
    return this.market.open(actor, nodeId, input);
  }

  @Post(':nodeId/sessions/:sessionId/interact')
  @HttpCode(200)
  interact(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
    @Param('sessionId') sessionId: string,
    @JsonBody(new ZodPipe(InteractSchema))
    input: z.infer<typeof InteractSchema>,
    @Res() response: ExpressResponse,
  ) {
    return withRequestAbort(response, async (signal) => {
      const prepared = await this.market.prepare(
        actor,
        nodeId,
        sessionId,
        input,
        signal,
      );
      signal.throwIfAborted();
      await streamSseEvents(response, (stream, _isAborted, replySignal) =>
        this.market.reply(prepared, replySignal, (event) =>
          stream.writeSSE({ data: JSON.stringify(event) }),
        ),
      );
    });
  }

  @Post(':nodeId/sessions/:sessionId/commit')
  @HttpCode(200)
  commit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
    @Param('sessionId') sessionId: string,
    @JsonBody(new ZodPipe(CommitSchema)) input: z.infer<typeof CommitSchema>,
  ) {
    return this.market.commit(actor, nodeId, sessionId, input);
  }

  @Post(':nodeId/sessions/:sessionId/leave')
  @HttpCode(200)
  leave(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('nodeId') nodeId: string,
    @Param('sessionId') sessionId: string,
    @JsonBody(new ZodPipe(LeaveSchema)) input: z.infer<typeof LeaveSchema>,
  ) {
    return this.market.leave(actor, nodeId, sessionId, input);
  }
}
