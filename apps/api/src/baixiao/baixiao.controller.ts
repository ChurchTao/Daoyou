import {
  BaixiaoResolveCommandSchema,
  BaixiaoTurnCommandSchema,
  BaixiaoWeekCommandSchema,
  type BaixiaoResolveCommand,
} from '@daoyou/contracts/baixiao/meet';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import { Access, CurrentCultivator } from '@server/auth/access.js';
import { apiErrorFilter } from '@server/http/error-filter.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { ZodError } from 'zod';
import { BaixiaoMeetService } from './application/BaixiaoMeetService.js';
import { BaixiaoStandings } from './application/BaixiaoStandings.js';

@Controller('api/baixiao-meet')
@Access('active')
@UseFilters(
  apiErrorFilter((error) =>
    error instanceof ZodError
      ? Response.json(
          { success: false, error: '作答参数无效。' },
          { status: 400 },
        )
      : undefined,
  ),
)
export class BaixiaoController {
  constructor(
    @Inject(BaixiaoMeetService) private readonly meet: BaixiaoMeetService,
    @Inject(BaixiaoStandings) private readonly standings: BaixiaoStandings,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.meet.status(actor);
  }

  @Get('ranking')
  @Header('Cache-Control', 'no-store')
  ranking(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.standings.ranking(actor);
  }

  @Post('start')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  start(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(BaixiaoWeekCommandSchema))
    command: { week: string },
  ) {
    return this.meet.start(command.week, actor);
  }

  @Post('next')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  next(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(BaixiaoTurnCommandSchema))
    command: { week: string; position: number },
  ) {
    return this.meet.next(command.week, command.position, actor);
  }

  @Post('resolve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resolve(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(BaixiaoResolveCommandSchema))
    command: BaixiaoResolveCommand,
  ) {
    return this.meet.resolve(command, actor);
  }
}
