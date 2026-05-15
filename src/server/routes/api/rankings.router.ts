import { deserializeAbilityConfig } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { getExecutor } from '@server/lib/drizzle/db';
import {
  consumables,
  creationProducts,
  cultivators,
} from '@server/lib/drizzle/schema';
import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  acquireChallengeLock,
  addToRanking,
  checkDailyChallenges,
  getCultivatorRank,
  getRankingList,
  getRemainingChallenges,
  incrementDailyChallenges,
  isLocked,
  isProtected,
  isRankingEmpty,
  releaseChallengeLock,
  updateRanking,
} from '@server/lib/redis/rankings';
import { createBattleRecordV2 } from '@server/lib/repositories/battleRecordV2Repository';
import {
  getCultivatorByIdUnsafe,
} from '@server/lib/services/cultivatorService';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import {
  EquipmentSlot,
  QUALITY_VALUES,
} from '@shared/types/constants';
import { getEquipmentSlotLabel } from '@shared/types/dictionaries';
import type { ItemRankingEntry } from '@shared/types/rankings';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const ChallengeSchema = z.object({
  targetId: z.string().optional().nullable(),
});

const ChallengeBattleSchema = z.object({
  targetId: z.string().optional().nullable(),
});

const router = new Hono<AppEnv>();
const publicRouter = new Hono<AppEnv>();
const challengeRouter = new Hono<AppEnv>();

publicRouter.get('/', async (c) => {
  try {
    const rankings = await getRankingList();
    return c.json({
      success: true,
      data: rankings,
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
    if (!type || !['artifact', 'skill', 'elixir', 'technique'].includes(type)) {
      return c.json({ success: false, error: '无效的榜单类型' }, 400);
    }

    let items: ItemRankingEntry[] = [];
    const limit = 100;
    const validQualities = QUALITY_VALUES.slice(2);
    const validProductQualities = QUALITY_VALUES.slice(2);

    if (type === 'artifact') {
      const rows = await getExecutor()
        .select({ item: creationProducts, owner: cultivators })
        .from(creationProducts)
        .leftJoin(cultivators, eq(creationProducts.cultivatorId, cultivators.id))
        .where(
          and(
            isNotNull(creationProducts.cultivatorId),
            eq(creationProducts.productType, 'artifact'),
            inArray(creationProducts.quality, validQualities as string[]),
          ),
        )
        .orderBy(desc(creationProducts.score))
        .limit(limit);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        itemType: 'artifact',
        type: getEquipmentSlotLabel(item.slot as EquipmentSlot),
        quality: item.quality ?? undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality ?? undefined,
        element: item.element ?? undefined,
        slot: item.slot ?? undefined,
        abilityConfig: item.abilityConfig ?? undefined,
        productModel: item.productModel ?? undefined,
      }));
    } else if (type === 'skill') {
      const rows = await getExecutor()
        .select({ item: creationProducts, owner: cultivators })
        .from(creationProducts)
        .leftJoin(cultivators, eq(creationProducts.cultivatorId, cultivators.id))
        .where(
          and(
            isNotNull(creationProducts.cultivatorId),
            eq(creationProducts.productType, 'skill'),
            inArray(creationProducts.quality, validProductQualities as string[]),
          ),
        )
        .orderBy(desc(creationProducts.score))
        .limit(limit);

      items = rows.map(({ item, owner }, index) => {
        const abilityConfig = deserializeAbilityConfig(
          (item.abilityConfig ?? {}) as Record<string, unknown>,
          item.id,
        );

        return {
          id: item.id,
          rank: index + 1,
          name: item.name,
          itemType: 'skill',
          type: item.element ? `${item.element}系神通` : '神通',
          quality: (item.quality as string | undefined) || undefined,
          ownerName: owner?.name || '未知',
          score: item.score || 0,
          description: item.description || '',
          title: item.quality || '未知品阶',
          element: item.element ?? undefined,
          cooldown: abilityConfig.cooldown ?? 0,
          cost: abilityConfig.mpCost || 0,
          abilityConfig: item.abilityConfig ?? undefined,
          productModel: item.productModel ?? undefined,
        };
      });
    } else if (type === 'elixir') {
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
        type: '丹药',
        quality: item.quality ?? undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality ?? undefined,
        quantity: item.quantity,
        spec: item.spec ?? undefined,
      }));
    } else if (type === 'technique') {
      const rows = await getExecutor()
        .select({ item: creationProducts, owner: cultivators })
        .from(creationProducts)
        .leftJoin(cultivators, eq(creationProducts.cultivatorId, cultivators.id))
        .where(
          and(
            isNotNull(creationProducts.cultivatorId),
            eq(creationProducts.productType, 'gongfa'),
            inArray(creationProducts.quality, validProductQualities as string[]),
          ),
        )
        .orderBy(desc(creationProducts.score))
        .limit(limit);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        itemType: 'technique',
        type: '功法',
        quality: (item.quality as string | undefined) || undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality || '未知品阶',
        abilityConfig: item.abilityConfig ?? undefined,
        productModel: item.productModel ?? undefined,
      }));
    }

    return c.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    return c.json({ success: false, error: '获取排行榜失败' }, 500);
  }
});

challengeRouter.get('/my-rank', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const rank = await getCultivatorRank(cultivator.id);
  const remainingChallenges = await getRemainingChallenges(cultivator.id);
  const isProtectedStatus = await isProtected(cultivator.id);

  return c.json({
    success: true,
    data: {
      rank,
      remainingChallenges,
      isProtected: isProtectedStatus,
    },
  });
});

challengeRouter.post('/probe', requireActiveCultivator(), async (c) => {
  try {
    const { targetId } = (await c.req.json()) as { targetId?: string };
    if (!targetId || typeof targetId !== 'string') {
      return c.json({ error: '请提供有效的目标角色ID' }, 400);
    }

    const targetRecord = await getCultivatorByIdUnsafe(targetId);
    if (!targetRecord) {
      return c.json({ error: '目标角色不存在或不可查探' }, 404);
    }

    const targetCultivator = targetRecord.cultivator;
    const { finalAttributes: targetFinal } =
      getCultivatorDisplayAttributes(targetCultivator);

    return c.json({
      success: true,
      data: {
        cultivator: targetCultivator,
        finalAttributes: targetFinal,
      },
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

challengeRouter.post('/challenge', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { targetId } = ChallengeSchema.parse(await c.req.json());
  const cultivatorId = cultivator.id;
  const challengeCheck = await checkDailyChallenges(cultivatorId);
  if (!challengeCheck.success) {
    return c.json({ error: '今日挑战次数已用完（每日限10次）' }, 400);
  }

  const isEmpty = await isRankingEmpty();
  const challengerRank = await getCultivatorRank(cultivatorId);

  if ((!targetId || targetId === '') && isEmpty && challengerRank === null) {
    await addToRanking(cultivatorId, user.id, 1);
    return c.json({
      success: true,
      message: '成功上榜，占据第一名！',
      data: {
        directEntry: true,
        rank: 1,
        remainingChallenges: challengeCheck.remaining,
      },
    });
  }

  if (!targetId || targetId.trim() === '') {
    return c.json({ error: '请提供被挑战者ID' }, 400);
  }

  const targetRank = await getCultivatorRank(targetId);
  if (targetRank === null) {
    return c.json({ error: '被挑战者不在排行榜上' }, 404);
  }

  if (await isProtected(targetId)) {
    return c.json({ error: '被挑战者处于新天骄保护期（2小时内不可挑战）' }, 400);
  }

  if (await isLocked(targetId)) {
    return c.json({ error: '被挑战者正在被其他玩家挑战，请稍后再试' }, 409);
  }

  return c.json({
    success: true,
    message: '挑战验证通过，可以开始战斗',
    data: {
      cultivatorId,
      targetId,
      challengerRank,
      targetRank,
      remainingChallenges: challengeCheck.remaining,
    },
  });
});

challengeRouter.post('/challenge-battle', requireActiveCultivator(), (c) => {
  return c.json(
    {
      error:
        '旧接口 /api/rankings/challenge-battle 已废弃，请使用 /api/rankings/challenge-battle/v5',
    },
    410,
  );
});

challengeRouter.post('/challenge-battle/v5', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const challenger = c.get('cultivator');
  if (!user || !challenger) {
    return c.json({ error: '未授权访问' }, 401);
  }

  let lockAcquired = false;
  let targetId: string | null = null;

  try {
    const parsed = ChallengeBattleSchema.parse(await c.req.json());
    targetId = parsed.targetId || null;
    const cultivatorId = challenger.id;

    const challengeCheck = await checkDailyChallenges(cultivatorId);
    if (!challengeCheck.success) {
      return c.json({ error: '今日挑战次数已用完（每日限10次）' }, 403);
    }

    const isEmpty = await isRankingEmpty();
    const challengerRank = await getCultivatorRank(cultivatorId);

    if ((!targetId || targetId === '') && isEmpty && challengerRank === null) {
      await addToRanking(cultivatorId, user.id, 1);
      return c.json({
        type: 'direct_entry',
        rank: 1,
        remainingChallenges: challengeCheck.remaining,
      });
    }

    if (!targetId || targetId.trim() === '') {
      return c.json({ error: '请提供被挑战者ID' }, 400);
    }

    const targetRank = await getCultivatorRank(targetId);
    if (targetRank === null) {
      return c.json({ error: '被挑战者不在排行榜上' }, 404);
    }

    if (await isProtected(targetId)) {
      return c.json({ error: '被挑战者处于新天骄保护期（2小时内不可挑战）' }, 403);
    }

    if (!(await acquireChallengeLock(targetId))) {
      return c.json({ error: '被挑战者正在被其他玩家挑战，请稍后再试' }, 429);
    }
    lockAcquired = true;

    const challengerRecord = await getCultivatorByIdUnsafe(cultivatorId);
    const targetRecord = await getCultivatorByIdUnsafe(targetId);
    if (!challengerRecord || !targetRecord) {
      return c.json({ error: '角色不存在' }, 404);
    }

    const battleResult = simulateBattleV5(
      challengerRecord.cultivator,
      targetRecord.cultivator,
    );

    const isWin = battleResult.winner.id === challenger.id;
    let newChallengerRank: number | null = challengerRank;
    let newTargetRank: number | null = targetRank;

    if (isWin && (challengerRank === null || challengerRank > targetRank)) {
      await updateRanking(cultivatorId, targetId);
      newChallengerRank = await getCultivatorRank(cultivatorId);
      newTargetRank = await getCultivatorRank(targetId);
    }

    const remainingChallenges = await incrementDailyChallenges(cultivatorId);

    await createBattleRecordV2({
      userId: user.id,
      cultivatorId,
      battleType: 'challenge',
      opponentCultivatorId: targetId,
      battleResult,
    });

    return c.json({
      type: 'battle_result',
      battleResult,
      rankingUpdate: {
        isWin,
        challengerRank: newChallengerRank,
        targetRank: newTargetRank,
        remainingChallenges,
      },
    });
  } catch (error) {
    console.error('挑战战斗流程错误:', error);
    return c.json(
      { error: error instanceof Error ? error.message : '挑战失败' },
      500,
    );
  } finally {
    if (lockAcquired && targetId) {
      await releaseChallengeLock(targetId);
    }
  }
});

router.route('/', publicRouter);
router.route('/', challengeRouter);

export default router;
