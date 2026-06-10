import { towerService } from '@server/lib/tower/service';
import { requireActiveCultivator } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import { TOWER_ELIGIBLE_REALMS } from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const battleRouter = new Hono<AppEnv>();

const BlessingSchema = z.object({
  blessingId: z.enum([
    'vitality_surge',
    'spirit_surge',
    'swift_step',
    'mind_focus',
    'jade_bones',
    'sea_of_qi',
    'breathing_technique',
    'meridian_cycle',
    'balanced_dao',
  ]),
});

const BattleIdBodySchema = z.object({
  battleId: z.string().min(1),
});

const BattleIdQuerySchema = z.object({
  battleId: z.string().min(1),
});

const LeaderboardQuerySchema = z.object({
  realm: z.enum(TOWER_ELIGIBLE_REALMS),
  limit: z.coerce.number().int().min(1).max(30).default(30),
});

router.post('/start', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const result = await towerService.startRun(cultivator.id);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '开启幻境失败';
    return c.json({ error: message }, 400);
  }
});

router.get('/state', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const result = await towerService.getState(
    cultivator.id,
    undefined,
    cultivator.realm as RealmType,
  );
  return c.json(result);
});

router.post('/reset', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const result = await towerService.resetRun(cultivator.id);
  return c.json(result);
});

router.post('/blessing/choose', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { blessingId } = BlessingSchema.parse(await c.req.json());
    const result = await towerService.chooseBlessing(cultivator.id, blessingId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '选择祝福失败';
    return c.json({ error: message }, 400);
  }
});

router.get('/leaderboard', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    const query = LeaderboardQuerySchema.parse({
      realm: c.req.query('realm'),
      limit: c.req.query('limit'),
    });
    const result = await towerService.getLeaderboard(
      cultivator?.id,
      query.realm,
      query.limit,
    );
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取塔榜失败';
    return c.json({ error: message }, 400);
  }
});

battleRouter.post('/probe', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const result = await towerService.probeBattle(cultivator.id);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '照见幻影失败';
    return c.json({ error: message }, 400);
  }
});

battleRouter.get('/context', requireActiveCultivator(), async (c) => {
  try {
    const cultivator = c.get('cultivator');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    const { battleId } = BattleIdQuerySchema.parse({
      battleId: c.req.query('battleId'),
    });
    const result = await towerService.getBattleContext(cultivator.id, battleId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取幻境战局失败';
    return c.json({ error: message }, 400);
  }
});

battleRouter.post('/execute/v5', requireActiveCultivator(), async (c) => {
  try {
    const user = c.get('user');
    const cultivator = c.get('cultivator');
    if (!user || !cultivator) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const { battleId } = BattleIdBodySchema.parse(await c.req.json());
    const result = await towerService.executeBattle(
      cultivator.id,
      battleId,
      new Date(),
      { deferPersistence: true },
    );
    const { persist, afterCommit, ...responseResult } = result;
    const data = {
      battleResult: responseResult.battleResult,
      callbackData: {
        towerState: responseResult.state,
        isFinished: responseResult.isFinished,
        settlement: responseResult.settlement,
        milestoneReward: responseResult.milestoneReward,
      },
    };

    if (!persist) {
      if (afterCommit) {
        await afterCommit();
      }
      return c.json({ success: true, data });
    }

    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'tower_battle_execute',
      run: async (tx) => {
        if (persist) {
          await persist(tx);
        }

        return {
          result: data,
          changes: [
            {
              domain: 'mail',
              eventType: 'mail.tower_milestone.created',
              invalidates: ['mail'],
            },
          ],
        };
      },
    });
    if (afterCommit) {
      await afterCommit();
    }
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const message = error instanceof Error ? error.message : '幻境战局执行失败';
    return c.json({ error: message }, 400);
  }
});

router.route('/battle', battleRouter);

export default router;
