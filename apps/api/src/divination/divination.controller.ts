import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  DivinationDrawSchema,
  DivinationInterpretSchema,
} from '@daoyou/shared/contracts/divination';
import type { Response } from 'express';
import type { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { JsonBody } from '../http/json-body.js';
import { streamSseEvents } from '../http/sse.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { DivinationExceptionFilter } from './divination-exception.filter.js';
import { DivinationService } from './divination.service.js';

@Controller('api/divination')
@Access('active')
@UseFilters(DivinationExceptionFilter)
export class DivinationController {
  constructor(
    @Inject(DivinationService) private readonly divination: DivinationService,
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

  @Post('interpret')
  @HttpCode(200)
  interpret(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(DivinationInterpretSchema))
    body: z.infer<typeof DivinationInterpretSchema>,
    @Res() response: Response,
  ) {
    return streamSseEvents(response, (stream, isAborted, signal) =>
      this.divination.interpret(actor, body.drawId, signal, async (event) => {
        if (isAborted()) return;
        try {
          await stream.writeSSE({ data: JSON.stringify(event) });
        } catch {
          // Settlement is independent of delivery of the final event.
        }
      }),
    );
  }
}
