import { rehydrateStoredProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
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
  addToRankingTailIfVacant,
  addToRanking,
  checkDailyChallenges,
  getCultivatorRank,
  getRankingList,
  getRemainingChallenges,
  incrementDailyChallenges,
  isLocked,
  isRankingEmpty,
  releaseChallengeLock,
  updateRanking,
} from '@server/lib/redis/rankings';
import { createBattleRecordV2 } from '@server/lib/repositories/battleRecordV2Repository';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import {
  getPlayerRuntimeCultivatorByIdUnsafe,
} from '@server/lib/services/cultivatorService';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import { TaskService } from '@server/lib/services/TaskService';
import type { BattleInitConfigV5 } from '@shared/types/battle';
import { withPlayerAbilityStrategySettings } from '@shared/lib/battle/abilityStrategyInit';
import { getCreationProductTypeLabel } from '@shared/lib/gameConceptDisplay';
import {
  EquipmentSlot,
  QUALITY_VALUES,
  REALM_VALUES,
  type ElementType,
  type RealmType,
} from '@shared/types/constants';
import {
  getConsumableTypeLabel,
  getEquipmentSlotLabel,
} from '@shared/lib/gameConceptDisplay';
import type { ItemRankingEntry } from '@shared/types/rankings';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const ChallengeSchema = z.object({
  targetId: z.string().optional().nullable(),
  realm: z.enum(REALM_VALUES).optional(),
});

const ChallengeBattleSchema = z.object({
  targetId: z.string().optional().nullable(),
  realm: z.enum(REALM_VALUES).optional(),
});

type RankingChangeType = 'challenge_win' | 'vacancy_entry' | null;

const router = new Hono<AppEnv>();
const publicRouter = new Hono<AppEnv>();
const challengeRouter = new Hono<AppEnv>();

function createFullResourcePvpBattleInit(): BattleInitConfigV5 {
  return {
    player: {
      resourceState: {
        hp: { mode: 'percent', value: 1 },
        mp: { mode: 'percent', value: 1 },
      },
    },
    opponent: {
      resourceState: {
        hp: { mode: 'percent', value: 1 },
        mp: { mode: 'percent', value: 1 },
      },
    },
  };
}

function getRehydratedProductModel(
  productModel: unknown,
  element?: string | null,
) {
  return rehydrateStoredProductModel(
    (productModel ?? null) as Record<string, unknown> | null,
    (element as ElementType | null) ?? undefined,
  );
}

function parseRealmQuery(raw: string | undefined | null): RealmType | null {
  if (!raw) return null;
  return REALM_VALUES.includes(raw as RealmType) ? (raw as RealmType) : null;
}

function getCultivatorRealm(cultivator: { realm?: string | null }): RealmType {
  return parseRealmQuery(cultivator.realm) ?? '炼气';
}

function buildRankingChangeRumor(params: {
  changeType: Exclude<RankingChangeType, null> | 'direct_entry';
  challengerName: string;
  targetName?: string;
  realm: RealmType;
  rank: number;
}) {
  if (params.changeType === 'direct_entry') {
    return `万界金榜初开，${params.challengerName}登临${params.realm}天骄榜第${params.rank}名。`;
  }

  if (params.changeType === 'vacancy_entry') {
    return `万界金榜有感，${params.challengerName}虽挑战${params.targetName ?? '榜上修士'}未胜，仍补入${params.realm}天骄榜第${params.rank}名。`;
  }

  return `万界金榜有感，${params.challengerName}击败${params.targetName ?? '榜上修士'}，登临${params.realm}天骄榜第${params.rank}名。`;
}

async function broadcastRankingChange(params: {
  userId: string;
  changeType: Exclude<RankingChangeType, null> | 'direct_entry';
  challengerName: string;
  targetName?: string;
  realm: RealmType;
  rank: number;
}) {
  const rumor = buildRankingChangeRumor(params);
  try {
    await createMessage({
      senderUserId: params.userId,
      senderCultivatorId: null,
      senderName: '修仙界传闻',
      senderRealm: '炼气',
      senderRealmStage: '系统',
      messageType: 'text',
      textContent: rumor,
      payload: { text: rumor },
    });
  } catch (chatError) {
    console.error('天骄榜名次变动传音发送失败:', chatError);
  }
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

      items = rows.map(({ item, owner }, index) => {
        const productModel =
          getRehydratedProductModel(item.productModel, item.element) ??
          item.productModel ??
          undefined;

        return {
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
          productModel,
        };
      });
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
        let cooldown = 0;
        let cost = 0;
        const productModel = getRehydratedProductModel(
          item.productModel,
          item.element,
        );

        if (productModel) {
          try {
            const abilityConfig = projectAbilityConfig(productModel);
            cooldown = abilityConfig.cooldown ?? 0;
            cost = abilityConfig.mpCost || 0;
          } catch {
            // fallback to defaults
          }
        }

        return {
          id: item.id,
          rank: index + 1,
          name: item.name,
          itemType: 'skill',
          type: item.element
            ? `${item.element}系${getCreationProductTypeLabel('skill')}`
            : getCreationProductTypeLabel('skill'),
          quality: (item.quality as string | undefined) || undefined,
          ownerName: owner?.name || '未知',
          score: item.score || 0,
          description: item.description || '',
          title: item.quality || '未知品阶',
          element: item.element ?? undefined,
          cooldown,
          cost,
          productModel: productModel ?? item.productModel ?? undefined,
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
        type: getConsumableTypeLabel('丹药'),
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

      items = rows.map(({ item, owner }, index) => {
        const productModel =
          getRehydratedProductModel(item.productModel, item.element) ??
          item.productModel ??
          undefined;

        return {
          id: item.id,
          rank: index + 1,
          name: item.name,
          itemType: 'technique',
          type: getCreationProductTypeLabel('gongfa'),
          quality: (item.quality as string | undefined) || undefined,
          ownerName: owner?.name || '未知',
          score: item.score || 0,
          description: item.description || '',
          title: item.quality || '未知品阶',
          productModel,
        };
      });
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

  const realm = parseRealmQuery(c.req.query('realm')) ?? getCultivatorRealm(cultivator);
  const rank = await getCultivatorRank(realm, cultivator.id);
  const remainingChallenges = await getRemainingChallenges(cultivator.id);

  return c.json({
    success: true,
    data: {
      rank,
      realm,
      remainingChallenges,
    },
  });
});

challengeRouter.post('/probe', requireActiveCultivator(), async (c) => {
  try {
    const { targetId } = (await c.req.json()) as { targetId?: string };
    if (!targetId || typeof targetId !== 'string') {
      return c.json({ error: '请提供有效的目标角色ID' }, 400);
    }

    const targetRecord = await getPlayerRuntimeCultivatorByIdUnsafe(targetId);
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

  const { targetId, realm: requestedRealm } = ChallengeSchema.parse(
    await c.req.json(),
  );
  const cultivatorId = cultivator.id;
  const ownRealm = getCultivatorRealm(cultivator);
  const rankingRealm = requestedRealm ?? ownRealm;
  const isOwnRealmRanking = rankingRealm === ownRealm;
  const challengeCheck = await checkDailyChallenges(cultivatorId);
  if (!challengeCheck.success) {
    return c.json({ error: '今日挑战次数已用完（每日限10次）' }, 400);
  }

  const isEmpty = await isRankingEmpty(rankingRealm);
  const challengerRank = await getCultivatorRank(rankingRealm, cultivatorId);

  if (
    (!targetId || targetId === '') &&
    isOwnRealmRanking &&
    isEmpty &&
    challengerRank === null
  ) {
    return c.json({
      success: true,
      message: '可直接上榜',
      data: {
        directEntry: true,
        realm: rankingRealm,
        rank: 1,
        remainingChallenges: challengeCheck.remaining,
      },
    });
  }

  if (!targetId || targetId.trim() === '') {
    return c.json(
      {
        error: isOwnRealmRanking
          ? '请提供被挑战者ID'
          : '越境榜单不可直接上榜，请选择榜上修士切磋',
      },
      400,
    );
  }

  const targetRank = await getCultivatorRank(rankingRealm, targetId);
  if (targetRank === null) {
    return c.json({ error: '被挑战者不在排行榜上' }, 404);
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
      realm: rankingRealm,
      challengerRank,
      targetRank,
      affectsRanking: isOwnRealmRanking,
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
    const ownRealm = getCultivatorRealm(challenger);
    const rankingRealm = parsed.realm ?? ownRealm;
    const affectsRanking = rankingRealm === ownRealm;

    const challengeCheck = await checkDailyChallenges(cultivatorId);
    if (!challengeCheck.success) {
      return c.json({ error: '今日挑战次数已用完（每日限10次）' }, 403);
    }

    const isEmpty = await isRankingEmpty(rankingRealm);
    const challengerRank = await getCultivatorRank(rankingRealm, cultivatorId);

    if (
      (!targetId || targetId === '') &&
      affectsRanking &&
      isEmpty &&
      challengerRank === null
    ) {
      await addToRanking(rankingRealm, cultivatorId, user.id, 1);
      const committed = await commitPlayerStateMutation({
        userId: user.id,
        cultivatorId,
        source: 'ranking_challenge_direct_entry',
        run: async () => ({
          result: {
            type: 'direct_entry' as const,
            realm: rankingRealm,
            rank: 1,
            remainingChallenges: challengeCheck.remaining,
          },
          changes: [
            {
              domain: 'tasks',
              eventType: 'tasks.ranking.direct_entry',
              invalidates: ['tasks'],
            },
          ],
        }),
      });
      await broadcastRankingChange({
        userId: user.id,
        changeType: 'direct_entry',
        challengerName: challenger.name,
        realm: rankingRealm,
        rank: 1,
      });
      return c.json(toPlayerStateMutationResponse(committed));
    }

    if (!targetId || targetId.trim() === '') {
      return c.json(
        {
          error: affectsRanking
            ? '请提供被挑战者ID'
            : '越境榜单不可直接上榜，请选择榜上修士切磋',
        },
        400,
      );
    }

    const targetRank = await getCultivatorRank(rankingRealm, targetId);
    if (targetRank === null) {
      return c.json({ error: '被挑战者不在排行榜上' }, 404);
    }

    if (!(await acquireChallengeLock(targetId))) {
      return c.json({ error: '被挑战者正在被其他玩家挑战，请稍后再试' }, 429);
    }
    lockAcquired = true;

    const challengerRecord = await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId);
    const targetRecord = await getPlayerRuntimeCultivatorByIdUnsafe(targetId);
    if (!challengerRecord || !targetRecord) {
      return c.json({ error: '角色不存在' }, 404);
    }

    const battleResult = simulateBattleV5(
      challengerRecord.cultivator,
      targetRecord.cultivator,
      withPlayerAbilityStrategySettings(
        createFullResourcePvpBattleInit(),
        challengerRecord.cultivator,
      ),
    );

    const isWin = battleResult.winner.id === challenger.id;
    let newChallengerRank: number | null = challengerRank;
    let newTargetRank: number | null = targetRank;
    let rankChangeType: RankingChangeType = null;

    if (
      affectsRanking &&
      isWin &&
      (challengerRank === null || challengerRank > targetRank)
    ) {
      await updateRanking(rankingRealm, cultivatorId, targetId);
      newChallengerRank = await getCultivatorRank(rankingRealm, cultivatorId);
      newTargetRank = await getCultivatorRank(rankingRealm, targetId);
      if (newChallengerRank !== null) {
        rankChangeType = 'challenge_win';
      }
    } else if (affectsRanking && !isWin && challengerRank === null) {
      newChallengerRank = await addToRankingTailIfVacant(
        rankingRealm,
        cultivatorId,
      );
      if (newChallengerRank !== null) {
        rankChangeType = 'vacancy_entry';
      }
    }

    const remainingChallenges = await incrementDailyChallenges(cultivatorId);

    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId,
      source: 'ranking_challenge_battle',
      run: async (tx) => {
        await createBattleRecordV2(
          {
            userId: user.id,
            cultivatorId,
            battleType: 'challenge',
            opponentCultivatorId: targetId,
            battleResult,
          },
          tx,
        );
        await TaskService.recordTaskEvent(
          cultivatorId,
          'ranking_challenge_battled',
          { tx },
        );

        return {
          result: {
            type: 'battle_result' as const,
            battleResult,
            rankingUpdate: {
              isWin,
              realm: rankingRealm,
              affectsRanking,
              challengerRank: newChallengerRank,
              targetRank: newTargetRank,
              remainingChallenges,
              rankChangeType,
            },
          },
          changes: [
            {
              domain: 'tasks',
              eventType: 'tasks.ranking.challenge_battled',
              invalidates: ['tasks'],
            },
          ],
        };
      },
    });

    if (rankChangeType && newChallengerRank !== null) {
      await broadcastRankingChange({
        userId: user.id,
        changeType: rankChangeType,
        challengerName: challengerRecord.cultivator.name,
        targetName: targetRecord.cultivator.name,
        realm: rankingRealm,
        rank: newChallengerRank,
      });
    }

    return c.json(toPlayerStateMutationResponse(committed));
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
