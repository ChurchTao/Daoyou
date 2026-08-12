import {
  getValidatedQuery,
  requireActiveCultivatorRef,
  validateQuery,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import { acquireRedisCooldown } from '@server/lib/redis/cooldownLimiter';
import type { AppEnv } from '@server/lib/hono/types';
import { FRIEND_SEARCH_COOLDOWN_SECONDS } from '@shared/config/socialConfig';
import {
  addFriendPair,
  FriendServiceError,
  getInviteTarget,
  listFriends,
  removeFriendPair,
  searchActiveCultivatorsByExactName,
} from '@server/lib/services/FriendService';
import { Hono } from 'hono';
import { z } from 'zod';

const CultivatorIdSchema = z.object({
  cultivatorId: z.string().uuid(),
});

const FriendSearchQuerySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

type FriendSearchQuery = z.infer<typeof FriendSearchQuerySchema>;

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const friends = await listFriends(cultivator.cultivatorId);
  return c.json({ friends });
});

router.get(
  '/search',
  requireActiveCultivatorRef(),
  validateQuery(FriendSearchQuerySchema),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const cooldown = await acquireRedisCooldown({
      key: `friends:search:cooldown:${cultivator.cultivatorId}`,
      cooldownSeconds: FRIEND_SEARCH_COOLDOWN_SECONDS,
      allowWhenRedisUnavailable: true,
    });
    if (!cooldown.allowed) {
      return c.json(
        { error: `请 ${cooldown.remainingSeconds} 秒后再搜索` },
        429,
      );
    }

    const { name } = getValidatedQuery<FriendSearchQuery>(c);
    const results = await searchActiveCultivatorsByExactName(
      cultivator.cultivatorId,
      name,
    );
    return c.json({ results });
  },
);

router.get('/invite/:cultivatorId', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { cultivatorId } = CultivatorIdSchema.parse({
      cultivatorId: c.req.param('cultivatorId'),
    });
    const result = await getInviteTarget(cultivator.cultivatorId, cultivatorId);
    return c.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }
    if (error instanceof FriendServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('Friend invite API error:', error);
    return c.json({ error: '查询道友失败' }, 500);
  }
});

router.post('/:cultivatorId', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { cultivatorId } = CultivatorIdSchema.parse({
      cultivatorId: c.req.param('cultivatorId'),
    });
    const friend = await addFriendPair(cultivator.cultivatorId, cultivatorId);
    return c.json({ friend, message: '已加入好友名录' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }
    if (error instanceof FriendServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('Friend add API error:', error);
    return c.json({ error: '添加道友失败' }, 500);
  }
});

router.delete('/:cultivatorId', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { cultivatorId } = CultivatorIdSchema.parse({
      cultivatorId: c.req.param('cultivatorId'),
    });
    await removeFriendPair(cultivator.cultivatorId, cultivatorId);
    return c.json({ message: '已移出好友名录' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }
    console.error('Friend delete API error:', error);
    return c.json({ error: '移除道友失败' }, 500);
  }
});

export default router;
