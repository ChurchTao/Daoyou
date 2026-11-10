import {
  AdminWorldChatMuteRequestSchema,
  type AdminWorldChatMuteRequest,
} from '@daoyou/contracts/admin/world-chat';
import {
  WorldChatListQuerySchema,
  type WorldChatListQuery,
} from '@daoyou/contracts/world-chat';
import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { AuthUser } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { AdminErrors } from './admin-errors.js';
import { AdminWorldChatService } from './world-chat.service.js';

@Controller('api/admin/world-chat')
@Access('admin')
@UseFilters(AdminErrors)
export class AdminWorldChatController {
  constructor(
    @Inject(AdminWorldChatService) private readonly chat: AdminWorldChatService,
  ) {}

  @Get('messages')
  @Header('Cache-Control', 'private, no-store')
  list(
    @FirstQuery(new ZodPipe(WorldChatListQuerySchema))
    query: WorldChatListQuery,
  ) {
    return this.chat.list(query);
  }

  @Get('mutes/:userId')
  @Header('Cache-Control', 'private, no-store')
  status(@Param('userId', new ZodPipe(z.uuid())) userId: string) {
    return this.chat.muteStatus(userId);
  }

  @Post('mutes/:userId')
  @HttpCode(200)
  mute(
    @Param('userId', new ZodPipe(z.uuid())) userId: string,
    @CurrentUser() actor: AuthUser,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(AdminWorldChatMuteRequestSchema),
    )
    input: AdminWorldChatMuteRequest,
  ) {
    return this.chat.mute(userId, actor.id, input);
  }

  @Delete('mutes/:userId')
  unmute(@Param('userId', new ZodPipe(z.uuid())) userId: string) {
    return this.chat.unmute(userId);
  }
}
