import {
  WorldChatCreateMessageSchema,
  WorldChatListQuerySchema,
  type WorldChatCreateMessageRequest,
  type WorldChatListQuery,
} from '@daoyou/contracts/world-chat';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { fromNodeHeaders } from 'better-auth/node';
import type { Response as ExpressResponse, Request } from 'express';
import { ZodError } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { SessionService } from '../auth/session.service.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { ChatError } from './application/chatError.js';
import { WorldChatService } from './world-chat.service.js';

export const SendErrors = apiErrorFilter((error) => {
  if (error instanceof ZodError) return undefined;
  if (error instanceof ChatError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        ...(error.remainingSeconds
          ? {
              remainingSeconds: error.remainingSeconds,
              retryAfterSeconds: error.remainingSeconds,
            }
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
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Get('messages')
  @Access('public')
  @UseFilters(SendErrors)
  async list(
    @FirstQuery(new ZodPipe(WorldChatListQuerySchema))
    query: WorldChatListQuery,
    @Req() request: Request,
    @Res({ passthrough: true }) response: ExpressResponse,
  ) {
    let actor: ActiveCultivatorRef | null = null;
    if (request.headers.cookie) {
      const session = await this.sessions.getSession(
        fromNodeHeaders(request.headers),
      );
      session.headers?.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') response.setHeader(key, value);
      });
      for (const cookie of session.headers?.getSetCookie() ?? [])
        response.append('Set-Cookie', cookie);
      if (session.response?.user)
        actor = await this.sessions.getActiveCultivator(session.response.user);
    }
    return this.chat.list(query, actor);
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
