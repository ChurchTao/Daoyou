import { requireActiveCultivator } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  addFriendPair,
  FriendServiceError,
  getInviteTarget,
  listFriends,
  removeFriendPair,
} from '@server/lib/services/FriendService';
import { Hono } from 'hono';
import { z } from 'zod';

const CultivatorIdSchema = z.object({
  cultivatorId: z.string().uuid(),
});

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const friends = await listFriends(cultivator.id);
  return c.json({ friends });
});

router.get('/invite/:cultivatorId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { cultivatorId } = CultivatorIdSchema.parse({
      cultivatorId: c.req.param('cultivatorId'),
    });
    const result = await getInviteTarget(cultivator.id, cultivatorId);
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

router.post('/:cultivatorId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { cultivatorId } = CultivatorIdSchema.parse({
      cultivatorId: c.req.param('cultivatorId'),
    });
    const friend = await addFriendPair(cultivator.id, cultivatorId);
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

router.delete('/:cultivatorId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { cultivatorId } = CultivatorIdSchema.parse({
      cultivatorId: c.req.param('cultivatorId'),
    });
    await removeFriendPair(cultivator.id, cultivatorId);
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
