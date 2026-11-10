import type {
  AdminWorldChatMessagesResponse,
  AdminWorldChatMuteRequest,
} from '@daoyou/contracts/admin/world-chat';
import type { WorldChatListQuery } from '@daoyou/contracts/world-chat';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { authUsers } from '@server/lib/auth/schema.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  listWorldChatMutes,
  removeWorldChatMute,
  setWorldChatMute,
} from '@server/lib/redis/worldChatModeration.js';
import { listChatMessages } from '@server/lib/repositories/chatRepository.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class AdminWorldChatService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(
    query: WorldChatListQuery,
  ): Promise<AdminWorldChatMessagesResponse> {
    const result = await listChatMessages(
      { ...query, channel: 'world', pageSize: query.limit ?? query.pageSize },
      this.database,
    );
    const users = [
      ...new Set(result.messages.map((message) => message.senderUserId)),
    ];
    return {
      success: true,
      data: result.messages,
      pagination: result.pagination,
      mutes: await listWorldChatMutes(users),
    };
  }

  async muteStatus(userId: string) {
    return {
      success: true,
      data: (await listWorldChatMutes([userId]))[userId] ?? null,
    };
  }

  async mute(
    userId: string,
    adminId: string,
    input: AdminWorldChatMuteRequest,
  ) {
    const [user] = await this.database
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .limit(1);
    if (!user)
      throw new HttpException({ success: false, error: '账号不存在' }, 404);
    const data = await setWorldChatMute(userId, adminId, input);
    return { success: true, data };
  }

  async unmute(userId: string) {
    await removeWorldChatMute(userId);
    return { success: true, data: null };
  }
}
