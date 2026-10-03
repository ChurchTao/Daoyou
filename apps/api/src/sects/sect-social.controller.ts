import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  SectChatListQuerySchema,
  WorldChatCreateMessageSchema,
  type SectChatListQuery,
  type WorldChatCreateMessageRequest,
} from '@daoyou/shared/contracts/world-chat';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { SectSocialService } from './sect-social.service.js';

const ContributionErrors = apiErrorFilter((error) => {
  if (error instanceof Error && error.message === 'SECT_MEMBERSHIP_REQUIRED')
    return Response.json(
      { success: false, error: '尚未拜入宗门' },
      { status: 404 },
    );
  console.error('[sect-ranking] read failed', error);
  return Response.json(
    { success: false, error: '贡献榜读取失败' },
    { status: 500 },
  );
});

@Controller('api/sects/current')
@Access('active')
export class SectSocialController {
  constructor(
    @Inject(SectSocialService) private readonly social: SectSocialService,
  ) {}

  @Get('chat/messages')
  list(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(SectChatListQuerySchema, 'legacy-unhandled'))
    query: SectChatListQuery,
  ) {
    return this.social.list(actor, query);
  }

  @Post('chat/messages')
  @HttpCode(200)
  create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(WorldChatCreateMessageSchema, 'legacy-unhandled'),
    )
    body: WorldChatCreateMessageRequest,
  ) {
    return this.social.create(actor, body);
  }

  @Get('contribution-ranking')
  @UseFilters(ContributionErrors)
  contributionRanking(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.social.contributionRanking(actor);
  }
}
