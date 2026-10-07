import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  RequestMethod,
  Sse,
  SseSignal,
  UseFilters,
  type MessageEvent,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  DivinationDrawSchema,
  DivinationInterpretSchema,
} from '@daoyou/contracts/divination';
import type { Observable } from 'rxjs';
import type { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { JsonBody } from '../http/json-body.js';
import type { GameRequest } from '../http/request.js';
import { SseResponseService } from '../http/sse-response.service.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { DivinationExceptionFilter } from './divination-exception.filter.js';
import { DivinationService } from './divination.service.js';

@Controller('api/divination')
@Access('active')
@UseFilters(DivinationExceptionFilter)
export class DivinationController {
  constructor(
    @Inject(DivinationService) private readonly divination: DivinationService,
    @Inject(SseResponseService) private readonly sse: SseResponseService,
  ) {}

  @Get()
  read(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.divination.read(actor);
  }

  @Post('draw')
  @HttpCode(200)
  draw(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DivinationDrawSchema))
    body: z.infer<typeof DivinationDrawSchema>,
  ) {
    return this.divination.draw(actor, body.direction);
  }

  @Sse('interpret', { method: RequestMethod.POST })
  @HttpCode(200)
  interpret(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DivinationInterpretSchema))
    body: z.infer<typeof DivinationInterpretSchema>,
    @SseSignal() signal: AbortSignal,
    @Req() request: GameRequest,
  ): Promise<Observable<MessageEvent>> {
    return this.sse.stream(request, signal, async () => (emit, streamSignal) =>
      this.divination.interpret(actor, body.drawId, streamSignal, emit),
    );
  }
}
