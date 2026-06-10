import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import {
  requireActiveCultivator,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import { TaskService } from '@server/lib/services/TaskService';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const ListQuerySchema = z.object({
  status: z.enum(['active', 'completed']).optional(),
});

const router = new Hono<AppEnv>();

async function countUnreadMail(
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const [result] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivatorId), eq(mails.isRead, false)));

  return Number(result?.count ?? 0);
}

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { status } = ListQuerySchema.parse(c.req.query());
    const tasks = await TaskService.listCultivatorTasks(
      ref.cultivatorId,
      status,
    );
    return c.json({
      success: true,
      data: {
        tasks,
      },
    });
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

router.post('/:id/challenge', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const result = await TaskService.runTaskChallenge(
      cultivator.id,
      c.req.param('id'),
    );

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
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

router.post('/:id/claim-reward', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'task_claim_reward',
      run: async (tx) => {
        const result = await TaskService.claimTaskReward(
          user.id,
          cultivator.id,
          c.req.param('id'),
          { tx },
        );
        const unreadMailCount = await countUnreadMail(cultivator.id, tx);

        return {
          result,
          changes: [
            {
              domain: 'tasks' as const,
              eventType: 'tasks.reward_claimed',
              invalidates: ['tasks' as const],
            },
            {
              domain: 'mail' as const,
              eventType: 'mail.reward_created',
              patch: { unreadMailCount },
              invalidates: ['mail' as const],
            },
          ],
        };
      },
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
