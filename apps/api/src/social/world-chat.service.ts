import type {
  WorldChatCreateMessageRequest,
  WorldChatListQuery,
} from '@daoyou/contracts/world-chat';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { checkAndAcquireCooldown } from '@server/lib/redis/worldChatLimiter.js';
import {
  listLatestMessages,
  listMessages,
} from '@server/lib/repositories/worldChatRepository.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import { createCultivatorChatMessage } from '@server/social/application/chatMessageApplication.js';

@Injectable()
export class WorldChatService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  async list({ channel, limit, page, pageSize }: WorldChatListQuery) {
    if (limit)
      return { success: true, data: await listLatestMessages(limit, channel) };
    const currentPage = page || 1;
    const currentPageSize = pageSize || 20;
    const result = await listMessages({
      channel,
      page: currentPage,
      pageSize: currentPageSize,
    });
    return {
      success: true,
      data: result.messages,
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        hasMore: result.hasMore,
      },
    };
  }

  async create(
    actor: ActiveCultivatorRef,
    request: WorldChatCreateMessageRequest,
  ) {
    const message = await createCultivatorChatMessage({
      request,
      database: this.database,
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      channel: 'world',
      sectId: null,
      acquireCooldown: checkAndAcquireCooldown,
      persist: (input) =>
        createAndPublishWorldChatMessage({ ...input, channel: 'world' }),
    });
    return { success: true, data: message };
  }
}
