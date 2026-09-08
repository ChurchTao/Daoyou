import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  toPlayerStateMutationResponse,
} from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import {
  claimTaskRewardCommand,
} from '@server/lib/services/TaskApplicationService';
import { TaskService } from '@server/lib/services/TaskService';
import { startBreakthroughBattle } from '@server/lib/services/combat-v6/CombatV6BreakthroughService';
import { redisLockErrorResponse } from '@server/lib/hono/middleware';
import { Hono } from 'hono';
import { z } from 'zod';

const ListQuerySchema = z.object({
  status: z.enum(['active', 'completed']).optional(),
});

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { status } = ListQuerySchema.parse(c.req.query());
    return c.json(
      await readResourceWithMeta(
        { kind: 'cultivator', id: ref.cultivatorId },
        'player.tasks',
        (tx) =>
          TaskService.readCultivatorTasks(ref.cultivatorId, status, tx),
      ),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '查询参数错误' }, 400);
    }
    console.error('获取任务列表失败:', error);
    return c.json({ error: '获取任务列表失败，请稍后再试' }, 500);
  }
});

router.get('/:id', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const task = await TaskService.getCultivatorTask(
      ref.cultivatorId,
      c.req.param('id'),
    );
    if (!task) {
      return c.json({ error: '任务不存在' }, 404);
    }

    return c.json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return c.json({ error: '获取任务详情失败，请稍后再试' }, 500);
  }
});

router.post('/:id/challenge', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const ref = c.get('activeCultivatorRef');
  if (!user || !ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const session = await startBreakthroughBattle({
      userId: user.id,
      cultivatorId: ref.cultivatorId,
    }, z.uuid().parse(c.req.param('id')));
    return c.json({ success: true, data: session });
  } catch (error) {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    const message =
      error instanceof Error ? error.message : '试炼失败，请稍后再试';
    const status =
      message === '任务不存在'
        ? 404
        : message.includes('没有可执行')
          ? 409
          : 400;
    return c.json({ error: message }, status);
  }
});

router.post('/:id/claim-reward', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const ref = c.get('activeCultivatorRef');
  if (!user || !ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const committed = await claimTaskRewardCommand({
      userId: user.id,
      cultivatorId: ref.cultivatorId,
      taskId: c.req.param('id'),
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '领取奖励失败，请稍后再试';
    const status =
      message === '任务不存在'
        ? 404
        : message.includes('尚未完成') || message.includes('已经领取')
          ? 409
          : 400;
    return c.json({ error: message }, status);
  }
});

export default router;
