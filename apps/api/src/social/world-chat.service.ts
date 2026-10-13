import type {
  WorldChatCreateMessageRequest,
  WorldChatListQuery,
} from '@daoyou/contracts/world-chat';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  checkAndAcquireCooldown,
  getChatCooldownRemaining,
} from '@server/lib/redis/worldChatLimiter.js';
import { listMessages } from '@server/lib/repositories/worldChatRepository.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import { createCultivatorChatMessage } from '@server/social/application/chatMessageApplication.js';
import { RedPacketService } from './application/RedPacketService.js';

@Injectable()
export class WorldChatService {
  private readonly packets: RedPacketService;
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {
    this.packets = new RedPacketService(database);
  }
  async list(query: WorldChatListQuery, actor?: ActiveCultivatorRef | null) {
    const result = await listMessages({
      ...query,
      pageSize: query.limit ?? query.pageSize,
    });
    return {
      success: true,
      data: result.messages,
      pagination: result.pagination,
      cooldownRemainingSeconds: actor
        ? await getChatCooldownRemaining(actor.cultivatorId, 'world')
        : 0,
    };
  }

  async create(
    actor: ActiveCultivatorRef,
    request: WorldChatCreateMessageRequest,
  ) {
    if (request.messageType === 'red_packet')
      return this.packets.create(actor, request, {
        channel: 'world',
        sectId: null,
      });
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
    return {
      success: true,
      data: message,
      cooldownSeconds: await getChatCooldownRemaining(
        actor.cultivatorId,
        'world',
      ),
    };
  }
}
