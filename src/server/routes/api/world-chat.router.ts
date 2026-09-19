import {
  getValidatedJson,
  getValidatedQuery,
  requireActiveCultivatorRef,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { rejectRetiredBattleShare } from '@server/lib/hono/chat';
import { checkAndAcquireCooldown } from '@server/lib/redis/worldChatLimiter';
import {
  createMessage,
  listLatestMessages,
  listMessages,
} from '@server/lib/repositories/worldChatRepository';
import {
  ChatMessageApplicationError,
  createCultivatorChatMessage,
} from '@server/lib/services/chatMessageApplication';
import {
  WorldChatCreateMessageSchema,
  WorldChatListQuerySchema,
  type WorldChatCreateMessageRequest,
  type WorldChatListQuery,
} from '@shared/contracts/world-chat';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/messages', validateQuery(WorldChatListQuerySchema), async (c) => {
  const { channel, limit, page, pageSize } =
    getValidatedQuery<WorldChatListQuery>(c);

  if (limit) {
    const messages = await listLatestMessages(limit, channel);
    return c.json({ success: true, data: messages });
  }

  const currentPage = page || 1;
  const currentPageSize = pageSize || 20;
  const result = await listMessages({
    channel,
    page: currentPage,
    pageSize: currentPageSize,
  });
  return c.json({
    success: true,
    data: result.messages,
    pagination: {
      page: currentPage,
      pageSize: currentPageSize,
      hasMore: result.hasMore,
    },
  });
});

router.post(
  '/messages',
  requireActiveCultivatorRef(),
  rejectRetiredBattleShare,
  validateJson(WorldChatCreateMessageSchema),
  async (c) => {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }

    try {
      const message = await createCultivatorChatMessage({
        request: getValidatedJson<WorldChatCreateMessageRequest>(c),
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
        channel: 'world',
        sectId: null,
        acquireCooldown: checkAndAcquireCooldown,
        persist: (input) => createMessage({ ...input, channel: 'world' }),
      });
      return c.json({ success: true, data: message });
    } catch (error) {
      if (error instanceof ChatMessageApplicationError) {
        return c.json(
          {
            success: false,
            error: error.message,
            ...(error.remainingSeconds
              ? { remainingSeconds: error.remainingSeconds }
              : {}),
          },
          error.status,
        );
      }
      console.error('Create world chat message error:', error);
      return c.json({ success: false, error: '发送失败，请稍后重试' }, 500);
    }
  },
);

export default router;
