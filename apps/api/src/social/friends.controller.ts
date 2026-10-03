import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { FriendServiceError } from '@server/social/application/FriendService.js';
import { z } from 'zod';
import { Access, CurrentCultivator } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { FirstQuery } from '../http/first-query.js';
import { ZodPipe } from '../http/zod.pipe.js';
import { FriendsService } from './friends.service.js';

const TargetSchema = z.object({ cultivatorId: z.string().uuid() });
const SearchSchema = z.object({ name: z.string().trim().min(1).max(100) });
const friendErrors = (fallback: string, handleDomain = true) =>
  apiErrorFilter((error) => {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: '参数错误', details: error.issues },
        { status: 400 },
      );
    if (handleDomain && error instanceof FriendServiceError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('Friend API error:', error);
    return Response.json({ error: fallback }, { status: 500 });
  });

@Controller('api/friends')
@Access('active')
export class FriendsController {
  constructor(
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  @Get()
  list(@CurrentCultivator() actor: ActiveCultivatorRef) {
    return this.friends.list(actor.cultivatorId);
  }

  @Get('search')
  search(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @FirstQuery(new ZodPipe(SearchSchema)) query: z.infer<typeof SearchSchema>,
  ) {
    return this.friends.search(actor.cultivatorId, query.name);
  }

  @Get('invite/:cultivatorId')
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
  ) {
    return this.friends.add(actor.cultivatorId, params.cultivatorId);
  }

  @Delete(':cultivatorId')
  @UseFilters(friendErrors('移除道友失败', false))
  remove(
    @CurrentCultivator() actor: ActiveCultivatorRef,
    @Param(new ZodPipe(TargetSchema)) params: z.infer<typeof TargetSchema>,
  ) {
    return this.friends.remove(actor.cultivatorId, params.cultivatorId);
  }
}
