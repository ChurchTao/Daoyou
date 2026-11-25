import {
  InvasionCommandSchema,
  type InvasionCommand,
} from '@daoyou/contracts/invasion';
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
import { ArenaV6Error } from '@server/combat/application/CombatV6ArenaService.js';
import { apiErrorFilter } from '@server/http/error-filter.js';
import { JsonBody } from '@server/http/json-body.js';
import { ZodPipe } from '@server/http/zod.pipe.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { ZodError } from 'zod';
import { readInvasionRanking } from './invasion-week.js';
import { InvasionService } from './invasion.service.js';

@Controller('api/ancient-demon-invasion')
@Access('active')
@UseFilters(
  apiErrorFilter((error) => {
    if (error instanceof ZodError)
      return Response.json(
        { success: false, error: '营地指令无效' },
        { status: 400 },
      );
    if (
      error instanceof ArenaV6Error ||
      error instanceof PlayerCommandIdempotencyError
    )
      return Response.json(
        { success: false, error: error.message },
        { status: error.status },
      );
  }),
)
export class InvasionController {
  constructor(
    @Inject(InvasionService) private readonly invasion: InvasionService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  status(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.invasion.status(actor);
  }

  @Get('ranking')
  @Header('Cache-Control', 'no-store')
  ranking() {
    return readInvasionRanking();
  }

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  command(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody({ fallback: undefined }, new ZodPipe(InvasionCommandSchema))
    input: InvasionCommand,
  ) {
    return this.invasion.command(actor, input);
  }
}
