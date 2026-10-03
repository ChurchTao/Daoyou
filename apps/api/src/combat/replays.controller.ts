import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Res,
  UseFilters,
  type PipeTransform,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { CombatV6ReplayParamsSchema } from '@daoyou/shared/contracts/combatV6';
import { CombatV6HistoryQuerySchema } from '@daoyou/shared/contracts/combatV6Replay';
import type { Response } from 'express';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { CombatErrors } from './combat-errors.js';
import { ReplaysService } from './replays.service.js';

@Controller('api/combat-v6/replays')
@Access('active')
export class ReplaysController {
  constructor(
    @Inject(ReplaysService) private readonly replays: ReplaysService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @UseFilters(CombatErrors)
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(CombatV6HistoryQuerySchema))
    query: z.infer<typeof CombatV6HistoryQuerySchema>,
  ) {
    return this.replays.list(actor.cultivatorId, query);
  }

  @Get(':battleId')
  @Header('Cache-Control', 'private, no-store')
  @UseFilters(CombatErrors)
  async read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6ReplayParamsSchema))
    params: z.infer<typeof CombatV6ReplayParamsSchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.replays.read(actor, params.battleId);
    response.status(result.status);
    return result.body;
  }

  @Post(':battleId/share')
  @HttpCode(200)
  share(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(CombatV6ReplayParamsSchema))
    params: z.infer<typeof CombatV6ReplayParamsSchema>,
  ) {
    return this.replays.share(actor, params.battleId);
  }
}

class ShareCodePipe implements PipeTransform<string, string> {
  transform(value: string) {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success)
      throw new HttpException({ success: false, error: '分享链接无效' }, 404);
    return parsed.data;
  }
}

@Controller('api/combat-v6-shares')
@Access('public')
export class SharedReplaysController {
  constructor(
    @Inject(ReplaysService) private readonly replays: ReplaysService,
  ) {}

  @Get(':shareCode')
  async read(
    @Param('shareCode', new ShareCodePipe()) shareCode: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.replays.shared(shareCode);
    response.setHeader('Cache-Control', 'public, max-age=60');
    return result;
  }
}
