import { getExecutor } from '@server/lib/drizzle/db';
import { consumables, cultivators } from '@server/lib/drizzle/schema';
import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getCultivatorRank,
  getRankingList,
  getRemainingChallenges,
} from '@server/lib/redis/rankings';
import { InventoryError } from '@server/lib/services/InventoryService';
import { CombatV6BuildError } from '@server/lib/services/combat-v6/CombatV6BuildService';
import {
  pendingRanking,
  RankingV6Error,
  runRankingChallenge,
} from '@server/lib/services/combat-v6/CombatV6RankingService';
import { loadCultivatorInspectionData } from '@server/lib/services/cultivator/CultivatorCombatProjectionReader';
import { readCultivatorRealm } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { RankingChallengeSchema } from '@shared/contracts/combatV6Ranking';
import { getConsumableTypeLabel } from '@shared/lib/gameConceptDisplay';
import {
  QUALITY_VALUES,
  REALM_VALUES,
  type RealmType,
} from '@shared/types/constants';
import type {
  ItemRankingEntry,
  WealthRankingEntry,
} from '@shared/types/rankings';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const publicRouter = new Hono<AppEnv>();
const challengeRouter = new Hono<AppEnv>();

function parseRealmQuery(raw: string | undefined | null): RealmType | null {
  if (!raw) return null;
  return REALM_VALUES.includes(raw as RealmType) ? (raw as RealmType) : null;
}

publicRouter.get('/', async (c) => {
  try {
    const realm = parseRealmQuery(c.req.query('realm')) ?? '炼气';
    const rankings = await getRankingList(realm);
    return c.json({
      success: true,
      data: rankings,
      realm,
    });
  } catch (error) {
    console.error('获取排行榜 API 错误:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取排行榜失败，请稍后重试'
        : '获取排行榜失败，请稍后重试';

    return c.json({ error: errorMessage }, 500);
  }
});

publicRouter.get('/items', async (c) => {
  try {
    const type = c.req.query('type');
    if (type && ['artifact', 'skill', 'technique'].includes(type))
      return c.json(
        { success: false, error: '旧装备、功法、神通榜单已停用' },
        410,
      );
    if (type !== 'elixir') {
      return c.json({ success: false, error: '无效的榜单类型' }, 400);
    }

    let items: ItemRankingEntry[] = [];
    const limit = 100;
    const validQualities = QUALITY_VALUES.slice(2);
    const rows = await getExecutor()
      .select({ item: consumables, owner: cultivators })
      .from(consumables)
      .leftJoin(cultivators, eq(consumables.cultivatorId, cultivators.id))
      .where(
        and(
          isNotNull(consumables.cultivatorId),
          eq(consumables.type, '丹药'),
          inArray(consumables.quality, validQualities as string[]),
        ),
      )
      .orderBy(desc(consumables.score))
      .limit(limit);

    items = rows.map(({ item, owner }, index) => ({
      id: item.id,
      rank: index + 1,
      name: item.name,
      itemType: 'elixir',
      type: getConsumableTypeLabel('丹药'),
      quality: item.quality ?? undefined,
      ownerName: owner?.name || '未知',
      score: item.score || 0,
      description: item.description || '',
      title: item.quality ?? undefined,
      quantity: item.quantity,
      spec: item.spec ?? undefined,
    }));

    return c.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    return c.json({ success: false, error: '获取排行榜失败' }, 500);
  }
});

publicRouter.get('/wealth', async (c) => {
  try {
    const limit = 100;
    const rows = await getExecutor()
      .select({
        id: cultivators.id,
        name: cultivators.name,
        title: cultivators.title,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        age: cultivators.age,
        origin: cultivators.origin,
        spiritStones: cultivators.spirit_stones,
      })
      .from(cultivators)
      .where(eq(cultivators.status, 'active'))
      .orderBy(desc(cultivators.spirit_stones))
      .limit(limit);

    const items: WealthRankingEntry[] = rows.map((row, index) => ({
      id: row.id,
      rank: index + 1,
      rankingType: 'wealth',
      name: row.name,
      title: row.title,
      realm: row.realm,
      realm_stage: row.realmStage,
      age: row.age,
      origin: row.origin,
      spiritStones: row.spiritStones,
    }));

    return c.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('获取财富榜失败:', error);
    return c.json({ success: false, error: '获取财富榜失败' }, 500);
  }
});

challengeRouter.get('/my-rank', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const own = await readCultivatorRealm(cultivator.cultivatorId);
  const realm = parseRealmQuery(c.req.query('realm')) ?? own.realm;
  const rank = await getCultivatorRank(realm, cultivator.cultivatorId);
  const remainingChallenges = await getRemainingChallenges(
    cultivator.cultivatorId,
  );

  return c.json({
    success: true,
    data: {
      rank,
      realm,
      remainingChallenges,
    },
  });
});

challengeRouter.post('/probe', requireActiveCultivatorRef(), async (c) => {
  try {
    const { targetId } = (await c.req.json()) as { targetId?: string };
    if (!targetId || typeof targetId !== 'string') {
      return c.json({ error: '请提供有效的目标角色ID' }, 400);
    }

    const inspection = await loadCultivatorInspectionData(targetId);
    if (!inspection) {
      return c.json({ error: '目标角色不存在或不可查探' }, 404);
    }

    return c.json({
      success: true,
      data: { cultivator: inspection },
    });
  } catch (error) {
    console.error('神识查探错误:', error);
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '神识查探失败'
        : '神识查探失败，请稍后重试';

    return c.json({ error: errorMessage }, 500);
  }
});

for (const path of [
  '/challenge',
  '/challenge-battle',
  '/challenge-battle/v5',
]) {
  challengeRouter.post(path, requireActiveCultivatorRef(), (c) =>
    c.json(
      { success: false, error: '旧天骄榜战斗已停用，请刷新使用新版挑战' },
      410,
    ),
  );
}
challengeRouter.get(
  '/challenge/current',
  requireActiveCultivatorRef(),
  async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({
      success: true,
      data: await pendingRanking(c.get('activeCultivatorRef')!.cultivatorId),
    });
  },
);
challengeRouter.post(
  '/challenge-battle/v6',
  requireActiveCultivatorRef(),
  async (c) => {
    c.header('Cache-Control', 'no-store');
    try {
      const data = await runRankingChallenge(
        {
          userId: c.get('user')!.id,
          cultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
        },
        RankingChallengeSchema.parse(await c.req.json()),
      );
      return c.json({ success: true, data });
    } catch (error) {
      const lock = redisLockErrorResponse(error);
      if (lock) return lock;
      if (error instanceof z.ZodError)
        return c.json({ success: false, error: '挑战参数无效' }, 400);
      if (error instanceof InventoryError)
        return c.json(
          { success: false, error: '请先结束当前战斗与结算，再发起天骄榜挑战' },
          409,
        );
      if (
        error instanceof RankingV6Error ||
        error instanceof CombatV6BuildError
      )
        return c.json({ success: false, error: error.message }, 409);
      console.error('[ranking-v6] challenge failed', error);
      return c.json(
        { success: false, error: '挑战尚未完成，请使用原请求重试恢复' },
        500,
      );
    }
  },
);

router.route('/', publicRouter);
router.route('/', challengeRouter);

export default router;
