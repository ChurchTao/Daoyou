import {
  DirectConversationsQuerySchema,
  DirectMessagesQuerySchema,
  OpenDirectConversationSchema,
  ReadDirectMessagesSchema,
  SendDirectMessageSchema,
  type DirectConversationsQuery,
  type DirectMessagesQuery,
  type SendDirectMessageRequest,
} from '@daoyou/contracts/direct-messages';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef, AuthUser } from '@server/lib/auth/types.js';
import { z } from 'zod';
import { Access, CurrentCultivator, CurrentUser } from '../auth/access.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { DirectMessagesService } from './direct-messages.service.js';
import { socialErrors } from './social-errors.js';

const IdSchema = z.object({ id: z.string().uuid() });
@Controller('api/direct-messages/conversations')
@Access('user')
@UseFilters(socialErrors)
export class DirectMessagesController {
  constructor(
    @Inject(DirectMessagesService)
    private readonly messages: DirectMessagesService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUser() user: AuthUser,
    @FirstQuery(new ZodPipe(DirectConversationsQuerySchema))
    query: DirectConversationsQuery,
  ) {
    return this.messages.list(user.id, query);
  }

  @Post()
  @HttpCode(200)
  @Access('active')
  open(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(OpenDirectConversationSchema))
    body: { cultivatorId: string },
  ) {
    return this.messages.open(actor, body.cultivatorId);
  }

  @Get(':id/messages')
  @Header('Cache-Control', 'private, no-store')
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(IdSchema)) params: { id: string },
    @FirstQuery(new ZodPipe(DirectMessagesQuerySchema))
    query: DirectMessagesQuery,
  ) {
    return this.messages.messages(user.id, params.id, query);
  }

  @Post(':id/messages')
  @HttpCode(200)
  @Access('active')
  send(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(IdSchema)) params: { id: string },
    @JsonBody(new ZodPipe(SendDirectMessageSchema))
    body: SendDirectMessageRequest,
  ) {
    return this.messages.send(actor, params.id, body);
  }

  @Put(':id/read')
  read(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(IdSchema)) params: { id: string },
    @JsonBody(new ZodPipe(ReadDirectMessagesSchema))
    body: { messageId: string },
  ) {
    return this.messages.read(user.id, params.id, body.messageId);
  }
}
