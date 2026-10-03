import {
  WorldChatCreateMessageSchema,
  WorldChatListQuerySchema,
  type WorldChatCreateMessageRequest,
  type WorldChatListQuery,
} from '@daoyou/shared/contracts/world-chat';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { ChatMessageApplicationError } from '@server/social/application/chatMessageApplication.js';
import { ZodError } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { WorldChatService } from './world-chat.service.js';

const SendErrors = apiErrorFilter((error) => {
  if (error instanceof ZodError) return undefined;
  if (error instanceof ChatMessageApplicationError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        ...(error.remainingSeconds
          ? { remainingSeconds: error.remainingSeconds }
          : {}),
      },
      { status: error.status },
    );
  }
  console.error('Create world chat message error:', error);
  return Response.json(
    { success: false, error: '发送失败，请稍后重试' },
    { status: 500 },
  );
});

@Controller('api/world-chat')
export class WorldChatController {
  constructor(
    @Inject(WorldChatService) private readonly chat: WorldChatService,
  ) {}

  @Get('messages')
  @Access('public')
  list(
    @FirstQuery(new ZodPipe(WorldChatListQuerySchema))
    query: WorldChatListQuery,
  ) {
    return this.chat.list(query);
  }

  @Post('messages')
  @HttpCode(200)
  @Access('active')
  @UseFilters(SendErrors)
  create(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(
      { fallback: undefined },
      new ZodPipe(WorldChatCreateMessageSchema),
    )
    body: WorldChatCreateMessageRequest,
  ) {
    return this.chat.create(actor, body);
  }
}
