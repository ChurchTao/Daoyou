import {
  CreateFriendRequestSchema,
  FriendRequestActionSchema,
} from '@daoyou/contracts/friends';
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
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { FriendServiceError } from '@server/social/application/FriendService.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { JsonBody, JsonBodyParseError } from '../http/json-body.js';
import { ZodPipe } from '../http/zod.pipe.js';
import {
  actOnFriendRequest,
  createFriendRequest,
  listFriendRequests,
} from './application/FriendRequestService.js';
import { FriendsService } from './friends.service.js';
import { socialValidationIssues } from './social-errors.js';

const TargetSchema = z.object({ cultivatorId: z.string().uuid() });
const SearchSchema = z.object({ name: z.string().trim().min(1).max(100) });
const friendErrors = (fallback: string, handleDomain = true) =>
  apiErrorFilter((error) => {
    const issues = socialValidationIssues(error);
    if (issues)
      return Response.json(
        { error: '参数错误', details: issues },
        { status: 400 },
      );
    if (error instanceof JsonBodyParseError)
      return Response.json({ error: '无效的 JSON 请求' }, { status: 400 });
    if (handleDomain && error instanceof FriendServiceError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('Friend API error:', error);
    return Response.json({ error: fallback }, { status: 500 });
  });

@Controller('api/friends')
@Access('active')
@UseFilters(friendErrors('好友操作失败'))
export class FriendsController {
  constructor(
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.friends.list(actor.cultivatorId);
  }

  @Get('requests')
  @Header('Cache-Control', 'private, no-store')
  requests(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return listFriendRequests(actor);
  }

  @Post('requests')
  @HttpCode(200)
  request(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @JsonBody(new ZodPipe(CreateFriendRequestSchema))
    body: z.infer<typeof CreateFriendRequestSchema>,
  ) {
    return createFriendRequest(actor, body.cultivatorId, body.requestId);
  }

  @Post('requests/:id/:action')
  @HttpCode(200)
  action(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(
      new ZodPipe(
        z.object({
          id: z.string().uuid(),
          action: z.enum(['accept', 'reject', 'cancel']),
        }),
      ),
    )
    params: { id: string; action: 'accept' | 'reject' | 'cancel' },
    @JsonBody(new ZodPipe(FriendRequestActionSchema))
    body: z.infer<typeof FriendRequestActionSchema>,
  ) {
    return actOnFriendRequest(
      actor,
      params.id,
      params.action,
      body.expectedRevision,
    );
  }

  @Get('search')
  @Header('Cache-Control', 'private, no-store')
  search(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(SearchSchema)) query: z.infer<typeof SearchSchema>,
  ) {
    return this.friends.search(actor.cultivatorId, query.name);
  }

  @Get('invite/:cultivatorId')
  @Header('Cache-Control', 'private, no-store')
  @UseFilters(friendErrors('查询道友失败'))
  invite(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(TargetSchema)) params: z.infer<typeof TargetSchema>,
  ) {
    return this.friends.invite(actor.cultivatorId, params.cultivatorId);
  }

  @Post(':cultivatorId')
  @HttpCode(200)
  @UseFilters(friendErrors('添加道友失败'))
  add(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(TargetSchema)) params: z.infer<typeof TargetSchema>,
    @JsonBody(
      { fallback: {} },
      new ZodPipe(
        z.object({ requestId: z.string().uuid().optional() }).strict(),
      ),
    )
    body: { requestId?: string },
  ) {
    return this.friends.add(
      actor,
      params.cultivatorId,
      body.requestId ?? randomUUID(),
    );
  }

  @Delete(':cultivatorId')
  @UseFilters(friendErrors('移除道友失败', false))
  remove(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(TargetSchema)) params: z.infer<typeof TargetSchema>,
  ) {
    return this.friends.remove(actor, params.cultivatorId);
  }
}
