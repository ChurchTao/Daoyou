import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin.js';
import { ArenaV6Error } from '@server/combat/application/CombatV6ArenaService.js';
import {
  ArenaV6SubmitSchema,
  type ArenaV6Submit,
} from '@daoyou/contracts/combat/arena';
import type { Request } from 'express';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ArenaBattlesService } from './arena-battles.service.js';

const ArenaErrors = apiErrorFilter((error) => {
  if (error instanceof ArenaV6Error)
    return Response.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      { success: false, error: '请求参数无效' },
      { status: 400 },
    );
  console.error('[arena-v6] request failed', error);
  return Response.json(
    { success: false, error: '战斗请求失败，请刷新重试' },
    { status: 500 },
  );
});
const CursorSchema = z.coerce.number().int().min(-1).optional();

@Controller('api/combat-v6/arena')
@Access('active')
@UseFilters(ArenaErrors)
export class ArenaBattlesController {
  constructor(
    @Inject(ArenaBattlesService) private readonly battles: ArenaBattlesService,
  ) {}

  @Get([':battleId/socket', ':battleId/watch/socket'])
  @HttpCode(404)
  async withoutUpgrade(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('battleId') id: string,
    @Req() request: Request,
  ) {
    if (!isAllowedRealtimeOrigin(request.get('origin')))
      throw new HttpException({ error: 'Origin forbidden' }, 403);
    await this.battles.authorizeSocket(
      actor,
      z.uuid().parse(id),
      request.path.endsWith('/watch/socket'),
    );
    return { success: false, error: '接口不存在' };
  }

  @Get(':battleId')
  @Header('Cache-Control', 'private, no-store')
  read(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('battleId', new ZodPipe(z.uuid())) id: string,
    @FirstQuery('afterEventSeq', new ZodPipe(CursorSchema)) cursor?: number,
  ) {
    return this.battles.read(actor, id, false, cursor);
  }

  @Get(':battleId/watch')
  @Header('Cache-Control', 'private, no-store')
  watch(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('battleId', new ZodPipe(z.uuid())) id: string,
    @FirstQuery('afterEventSeq', new ZodPipe(CursorSchema)) cursor?: number,
  ) {
    return this.battles.read(actor, id, true, cursor);
  }

  @Post(':battleId/commands')
  @HttpCode(200)
  submit(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('battleId', new ZodPipe(z.uuid())) id: string,
    @JsonBody({ fallback: undefined }, new ZodPipe(ArenaV6SubmitSchema))
    input: ArenaV6Submit,
  ) {
    return this.battles.submit(actor, id, input);
  }

  @Get(':battleId/replay')
  replay(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param('battleId', new ZodPipe(z.uuid())) id: string,
  ) {
    return this.battles.replay(actor, id);
  }
}
