import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import {
  breakthroughHistory,
  consumables,
  cultivationTechniques,
  cultivators,
  mails,
  materials,
  redeemCodeClaims,
  redeemCodes,
  skills,
} from '@server/lib/drizzle/schema';
import {
  requireActiveCultivator,
  requireUser,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { runDetached } from '@server/lib/http/response';
import { consumeLifespanAndHandleDepletion } from '@server/lib/lifespan/handleLifespan';
import { renderPrompt } from '@server/lib/prompts';
import {
  isValidRedeemCodeFormat,
  normalizeRedeemCode,
} from '@server/lib/redeem/code';
import { redis } from '@server/lib/redis';
import { getLifespanLimiter } from '@server/lib/redis/lifespanLimiter';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import { ConsumableUseEngine } from '@server/lib/services/ConsumableUseEngine';
import {
  MailService,
  type MailAttachment,
} from '@server/lib/services/MailService';
import {
  identifyMysteryMaterial,
  MarketServiceError,
} from '@server/lib/services/MarketService';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  equipEquipment,
  getCultivatorArtifacts,
  getCultivatorById,
  getCultivatorConsumables,
  getCultivatorMaterials,
  getLastDeadCultivatorSummary,
  getPaginatedInventoryByType,
  updateCultivationExp,
  updateCultivator,
  updateLastYieldAt,
  updateSpiritStones,
} from '@server/lib/services/cultivatorService';
import { stream_text } from '@server/utils/aiClient';
import { createBreakthroughStory } from '@server/utils/storyService';
import { getRedeemPresetById } from '@shared/config/redeemRewardPresets';
import {
  attemptBreakthrough,
  performCultivation,
} from '@shared/engine/cultivation/CultivationEngine';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import type { GeneratedMaterial } from '@shared/engine/material/creation/types';
import { resourceEngine } from '@shared/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@shared/engine/resource/types';
import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const TitleSchema = z.object({
  title: z.string().min(2).max(8).optional().nullable(),
});

const ConsumeSchema = z.object({
  consumableId: z.string().uuid(),
});

const EquipSchema = z.object({
  artifactId: z.string(),
});

const ClaimRedeemCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

const RetreatSchema = z.object({
  years: z.number().optional(),
  action: z.enum(['cultivate', 'breakthrough']).default('cultivate'),
});

const DiscardSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(['artifact', 'consumable', 'material']),
});

const IdentifySchema = z.object({
  materialId: z.string().min(1),
});

const ClaimMailSchema = z.object({
  mailId: z.string(),
});

const ReadMailSchema = z.object({
  mailId: z.string(),
});

const ForgetSkillSchema = z.object({
  skillId: z.string(),
});

const ForgetTechniqueSchema = z.object({
  techniqueId: z.string(),
});

class RedeemClaimError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: string }).code === '23505';
}

function parseMaterialTypes(raw: string | null): MaterialType[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as MaterialType[];
  if (values.length === 0) return undefined;
  const validSet = new Set<MaterialType>(MATERIAL_TYPE_VALUES);
  if (values.some((value) => !validSet.has(value))) {
    throw new Error(`无效的材料类型，支持：${MATERIAL_TYPE_VALUES.join(', ')}`);
  }
  return values;
}

function parseMaterialRanks(raw: string | null): Quality[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as Quality[];
  if (values.length === 0) return undefined;
  const validSet = new Set<Quality>(QUALITY_VALUES);
  if (values.some((value) => !validSet.has(value))) {
    throw new Error(`无效的材料品级，支持：${QUALITY_VALUES.join(', ')}`);
  }
  return values;
}

function parseMaterialElements(raw: string | null): ElementType[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as ElementType[];
  if (values.length === 0) return undefined;
  const validSet = new Set<ElementType>(ELEMENT_VALUES);
  if (values.some((value) => !validSet.has(value))) {
    throw new Error(`无效的材料属性，支持：${ELEMENT_VALUES.join(', ')}`);
  }
  return values;
}

function buildMajorBreakthroughRumor(
  cultivatorName: string,
  toRealm?: string,
  toStage?: string,
): string {
  const target = `${toRealm ?? '未知境界'}${toStage ?? ''}`;
  const templates = [
    `${cultivatorName}闭关洞府霞光冲霄，竟一举破境，踏入「${target}」！`,
    `有修士夜观天象见异光东来，传闻${cultivatorName}已至「${target}」！`,
    `${cultivatorName}冲关成功，道音震荡八方，自此迈入「${target}」！`,
    `灵潮翻涌，雷声隐隐，${cultivatorName}于万众传闻中晋升「${target}」！`,
    `${cultivatorName}破开桎梏，境界再上一重楼，正式踏入「${target}」！`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

const router = new Hono<AppEnv>();
const inventoryRouter = new Hono<AppEnv>();
const mailRouter = new Hono<AppEnv>();
const skillsRouter = new Hono<AppEnv>();
const techniquesRouter = new Hono<AppEnv>();

router.get('/reincarnate-context', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const summary = await getLastDeadCultivatorSummary(user.id);
  return c.json({
    success: true,
    data: summary ?? null,
  });
});

router.post('/active-reincarnate', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  if (cultivator.status === 'dead') {
    return c.json({ error: '该角色已身死道消' }, 400);
  }

  await getExecutor().transaction(async (tx) => {
    await tx
      .update(cultivators)
      .set({ status: 'dead', diedAt: new Date() })
      .where(eq(cultivators.id, cultivator.id));

    await tx.insert(breakthroughHistory).values({
      cultivatorId: cultivator.id,
      from_realm: cultivator.realm,
      from_stage: cultivator.realm_stage,
      to_realm: '轮回',
      to_stage: '转世',
      age: cultivator.age,
      years_spent: 0,
      story: `道友${cultivator.name}感悟天道无常，寿元虽未尽，然道心已决。遂于今日自行兵解，散去一身修为，只求来世再踏仙途，重证大道。天地为之动容，降下祥云送行。`,
    });
  });

  return c.json({ success: true, message: '兵解成功，轮回已开' });
});

router.post('/consume', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const parsed = ConsumeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ success: false, error: '请求参数格式错误' }, 400);
  }

  try {
    const result = await ConsumableUseEngine.consume(
      user.id,
      cultivator.id,
      parsed.data.consumableId,
    );
    return c.json({
      success: true,
      data: {
        message: result.message,
        consumable: result.consumable,
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '使用失败',
      },
      400,
    );
  }
});

router.get('/equip', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const equippedItems = await creationProductRepository.findEquippedArtifacts(
    cultivator.id,
  );
  return c.json({
    success: true,
    data: {
      weapon: equippedItems.find((item) => item.slot === 'weapon')?.id ?? null,
      armor: equippedItems.find((item) => item.slot === 'armor')?.id ?? null,
      accessory:
        equippedItems.find((item) => item.slot === 'accessory')?.id ?? null,
    },
  });
});

router.post('/equip', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { artifactId } = EquipSchema.parse(await c.req.json());
  const equippedItems = await equipEquipment(
    user.id,
    cultivator.id,
    artifactId,
  );
  return c.json({
    success: true,
    data: equippedItems,
  });
});

router.get('/lifespan-status', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const limiter = getLifespanLimiter();
  const consumed = await limiter.getConsumedLifespan(cultivator.id);
  const remaining = await limiter.getRemainingLifespan(cultivator.id);
  const isLocked = await limiter.isRetreatLocked(cultivator.id);

  return c.json({
    success: true,
    data: {
      cultivatorId: cultivator.id,
      dailyLimit: 200,
      consumed,
      remaining,
      isInRetreat: isLocked,
    },
  });
});

router.post('/title', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { title } = TitleSchema.parse(await c.req.json());
  const updated = await getExecutor()
    .update(cultivators)
    .set({ title: title || null })
    .where(eq(cultivators.id, cultivator.id))
    .returning();

  return c.json({ success: true, data: updated[0] });
});

router.post('/redeem-code/claim', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const parsed = ClaimRedeemCodeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const normalizedCode = normalizeRedeemCode(parsed.data.code);
  if (!isValidRedeemCodeFormat(normalizedCode)) {
    return c.json({ error: '兑换码格式错误，仅支持 6-64 位大写字母数字' }, 400);
  }

  let mailId = '';

  try {
    await getExecutor().transaction(async (tx) => {
      const redeemCode = await tx.query.redeemCodes.findFirst({
        where: eq(redeemCodes.code, normalizedCode),
      });

      if (!redeemCode) {
        throw new RedeemClaimError('兑换码不存在', 404);
      }

      const now = new Date();
      if (redeemCode.status !== 'active') {
        throw new RedeemClaimError('兑换码已停用');
      }
      if (redeemCode.startsAt && redeemCode.startsAt > now) {
        throw new RedeemClaimError('兑换码尚未生效');
      }
      if (redeemCode.endsAt && redeemCode.endsAt < now) {
        throw new RedeemClaimError('兑换码已过期');
      }

      const claimed = await tx.query.redeemCodeClaims.findFirst({
        where: and(
          eq(redeemCodeClaims.redeemCodeId, redeemCode.id),
          eq(redeemCodeClaims.userId, user.id),
        ),
      });
      if (claimed) {
        throw new RedeemClaimError('该兑换码你已使用过');
      }

      const preset = getRedeemPresetById(redeemCode.rewardPresetId);
      if (!preset) {
        throw new RedeemClaimError('兑换奖励配置缺失，请联系管理员', 500);
      }

      const [reservedCode] = await tx
        .update(redeemCodes)
        .set({
          claimedCount: sql`${redeemCodes.claimedCount} + 1`,
        })
        .where(
          and(
            eq(redeemCodes.id, redeemCode.id),
            eq(redeemCodes.status, 'active'),
            sql`(${redeemCodes.startsAt} IS NULL OR ${redeemCodes.startsAt} <= NOW())`,
            sql`(${redeemCodes.endsAt} IS NULL OR ${redeemCodes.endsAt} >= NOW())`,
            sql`(${redeemCodes.totalLimit} IS NULL OR ${redeemCodes.claimedCount} < ${redeemCodes.totalLimit})`,
          ),
        )
        .returning({ id: redeemCodes.id });

      if (!reservedCode) {
        throw new RedeemClaimError('兑换码已被领完或失效');
      }

      const mail = await MailService.sendMail(
        cultivator.id,
        redeemCode.mailTitle,
        redeemCode.mailContent,
        preset.attachments,
        'reward',
        tx,
      );
      mailId = mail.id;

      await tx.insert(redeemCodeClaims).values({
        redeemCodeId: redeemCode.id,
        userId: user.id,
        cultivatorId: cultivator.id,
        mailId: mail.id,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: '该兑换码你已使用过' }, 400);
    }
    if (error instanceof RedeemClaimError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('Redeem claim error:', error);
    return c.json({ error: '兑换失败，请稍后重试' }, 500);
  }

  return c.json({
    success: true,
    message: '兑换成功，奖励已通过传音玉简发放',
    mailId,
  });
});

router.post('/retreat', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('cultivator');
  if (!user || !activeCultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const limiter = getLifespanLimiter();
  const cultivatorId = activeCultivator.id;
  let years = 0;
  let lockAcquired = false;

  try {
    const { years: inputYears, action } = RetreatSchema.parse(
      await c.req.json(),
    );
    years = inputYears ?? 0;

    lockAcquired = await limiter.acquireRetreatLock(cultivatorId);
    if (!lockAcquired) {
      return c.json({ error: '角色正在闭关中，请稍后再试' }, 409);
    }

    const cultivator = await getCultivatorById(user.id, cultivatorId);
    if (!cultivator) {
      return c.json({ error: '角色不存在' }, 404);
    }

    if (action === 'cultivate') {
      if (!Number.isFinite(years) || years < 1 || years > 200) {
        return c.json({ error: '闭关年限需在 1~200 年之间' }, 400);
      }
      if (cultivator.lifespan - cultivator.age < years) {
        return c.json({ error: '道友，您没有这么多寿元了' }, 400);
      }

      const lifespanCheck = await limiter.checkAndConsumeLifespan(
        cultivatorId,
        years,
      );
      if (!lifespanCheck.allowed) {
        return c.json(
          {
            error: lifespanCheck.message,
            remaining: lifespanCheck.remaining,
            consumed: lifespanCheck.consumed,
          },
          400,
        );
      }

      const result = performCultivation(cultivator, years);
      await addRetreatRecord(user.id, cultivatorId, result.record);

      const saved = await updateCultivator(cultivatorId, {
        age: result.cultivator.age,
        closed_door_years_total: result.cultivator.closed_door_years_total,
        cultivation_progress: result.cultivator.cultivation_progress,
      });

      if (!saved) {
        await limiter.rollbackLifespan(cultivatorId, years);
        throw new Error('更新角色数据失败');
      }

      try {
        const lifespanResult = await consumeLifespanAndHandleDepletion(
          cultivatorId,
          years,
        );
        if (lifespanResult.depleted && lifespanResult.story) {
          return c.json({
            success: true,
            data: {
              cultivator: lifespanResult.updatedCultivator ?? saved,
              summary: result.summary,
              action: 'cultivate',
              story: lifespanResult.story,
              storyType: 'lifespan',
              depleted: lifespanResult.depleted,
              lifespanInfo: {
                remaining: lifespanCheck.remaining,
                consumed: lifespanCheck.consumed,
              },
            },
          });
        }
      } catch (error) {
        console.warn('处理寿元耗尽失败：', error);
      }

      return c.json({
        success: true,
        data: {
          cultivator: saved,
          summary: result.summary,
          action: 'cultivate',
          lifespanInfo: {
            remaining: lifespanCheck.remaining,
            consumed: lifespanCheck.consumed,
          },
        },
      });
    }

    const result = attemptBreakthrough(cultivator);
    let story: string | undefined;
    let storyType: 'breakthrough' | 'lifespan' | null = null;

    if (result.summary.success) {
      try {
        story = await createBreakthroughStory({
          cultivator: result.cultivator,
          summary: {
            success: result.summary.success,
            isMajor: result.summary.toRealm !== result.summary.fromRealm,
            yearsSpent: 1,
            chance: result.summary.chance,
            roll: result.summary.roll,
            fromRealm: result.summary.fromRealm,
            fromStage: result.summary.fromStage,
            toRealm: result.summary.toRealm,
            toStage: result.summary.toStage,
            lifespanGained: result.summary.lifespanGained,
            attributeGrowth: result.summary.attributeGrowth,
            lifespanDepleted: false,
            modifiers: result.summary.modifiers,
          },
        });
        storyType = 'breakthrough';
        if (result.historyEntry && story) {
          result.historyEntry.story = story;
        }
      } catch (storyError) {
        console.warn('生成突破故事失败：', storyError);
      }

      const isMajorBreakthrough =
        result.summary.toRealm &&
        result.summary.toRealm !== result.summary.fromRealm;
      if (isMajorBreakthrough) {
        const rumor = buildMajorBreakthroughRumor(
          result.cultivator.name,
          result.summary.toRealm,
          result.summary.toStage,
        );
        try {
          await createMessage({
            senderUserId: user.id,
            senderCultivatorId: null,
            senderName: '修仙界传闻',
            senderRealm: '炼气',
            senderRealmStage: '系统',
            messageType: 'text',
            textContent: rumor,
            payload: { text: rumor },
          });
        } catch (chatError) {
          console.error('突破传闻发送失败:', chatError);
        }
      }
    }

    if (result.summary.success && result.historyEntry) {
      await addBreakthroughHistoryEntry(
        user.id,
        cultivatorId,
        result.historyEntry,
      );
    }

    const saved = await updateCultivator(cultivatorId, {
      realm: result.cultivator.realm,
      realm_stage: result.cultivator.realm_stage,
      age: result.cultivator.age,
      lifespan: result.cultivator.lifespan,
      attributes: result.cultivator.attributes,
      cultivation_progress: result.cultivator.cultivation_progress,
      persistent_state: result.cultivator.persistent_state,
    });

    return c.json({
      success: true,
      data: {
        cultivator: saved,
        summary: result.summary,
        story,
        storyType,
        action: 'breakthrough',
      },
    });
  } catch (err) {
    console.error('闭关突破 API 错误:', err);
    if (cultivatorId && years > 0) {
      try {
        await limiter.rollbackLifespan(cultivatorId, years);
      } catch (rollbackErr) {
        console.error('回滚寿元消耗失败:', rollbackErr);
      }
    }
    throw err;
  } finally {
    if (lockAcquired && cultivatorId) {
      try {
        await limiter.releaseRetreatLock(cultivatorId);
      } catch (unlockErr) {
        console.error('释放闭关锁失败:', unlockErr);
      }
    }
  }
});

router.post('/yield', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('cultivator');
  if (!user || !activeCultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const userId = user.id;
  const cultivatorId = activeCultivator.id;
  const lockKey = `yield:lock:${cultivatorId}`;
  const acquired = await redis.set(lockKey, 'locked', 'EX', 100, 'NX');

  if (!acquired) {
    return c.json(
      { success: false, error: '道友请勿心急，机缘正在结算中...' },
      429,
    );
  }

  try {
    const fullCultivator = await getCultivatorById(userId, cultivatorId);
    if (!fullCultivator) {
      await redis.del(lockKey);
      return c.json({ success: false, error: '未找到角色信息' }, 404);
    }

    const realm = fullCultivator.realm as RealmType;
    const lastYieldAt = fullCultivator.last_yield_at
      ? new Date(fullCultivator.last_yield_at)
      : new Date(Date.now());
    const now = new Date();
    const diffMs = now.getTime() - lastYieldAt.getTime();
    const hoursElapsed = Math.min(diffMs / (1000 * 60 * 60), 24);

    if (hoursElapsed < 1) {
      await redis.del(lockKey);
      return c.json(
        { success: false, error: '历练时日尚短（不足一小时），难有机缘。' },
        400,
      );
    }

    const operations = YieldCalculator.calculateYield(
      realm,
      hoursElapsed,
      fullCultivator,
    );
    const materialCount = YieldCalculator.calculateMaterialCount(hoursElapsed);

    let success = true;
    let error: string | undefined;

    try {
      await getExecutor().transaction(async (tx) => {
        for (const gain of operations) {
          switch (gain.type) {
            case 'spirit_stones':
              await updateSpiritStones(userId, cultivatorId, gain.value, tx);
              break;
            case 'cultivation_exp':
              await updateCultivationExp(
                userId,
                cultivatorId,
                gain.value,
                undefined,
                tx,
              );
              break;
            case 'comprehension_insight':
              await updateCultivationExp(
                userId,
                cultivatorId,
                0,
                gain.value,
                tx,
              );
              break;
            default:
              if (gain.type !== 'material') {
                throw new Error(`未知的资源类型: ${gain.type}`);
              }
          }
        }

        await updateLastYieldAt(userId, cultivatorId, tx);
      });
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);
    }

    if (!success) {
      await redis.del(lockKey);
      return c.json({ success: false, error: error || '发放奖励失败' }, 500);
    }

    const spiritStonesGain =
      operations.find((operation) => operation.type === 'spirit_stones')
        ?.value || 0;
    const expGain =
      operations.find((operation) => operation.type === 'cultivation_exp')
        ?.value || 0;
    const insightGain =
      operations.find((operation) => operation.type === 'comprehension_insight')
        ?.value || 0;

    const result = {
      cultivatorName: fullCultivator.name,
      cultivatorRealm: fullCultivator.realm,
      amount: spiritStonesGain,
      expGain,
      insightGain,
      materials: [] as GeneratedMaterial[],
      hours: hoursElapsed,
      materialCount,
    };

    if (materialCount > 0) {
      runDetached(async () => {
        try {
          console.log(
            `[Yield] 开始异步生成材料: cultivatorId=${cultivatorId}, count=${materialCount}`,
          );
          const generatedMaterials =
            await MaterialGenerator.generateRandom(materialCount);
          console.log(
            `[Yield] 材料生成完成: ${generatedMaterials.map((material) => `${material.rank}${material.name}`).join(', ')}`,
          );

          if (generatedMaterials.length === 0) {
            console.error(
              `[Yield] 材料生成结果为空，跳过空奖励邮件: cultivatorId=${cultivatorId}, expected=${materialCount}`,
            );
            return;
          }

          const attachments = generatedMaterials.map((material) => ({
            type: 'material' as const,
            name: material.name,
            quantity: material.quantity,
            data: material,
          }));

          await MailService.sendMail(
            cultivatorId,
            '历练机缘',
            '道友历练途中，偶得天材地宝，特以此传音玉简送达。',
            attachments,
            'reward',
          );
          console.log('[Yield] 材料奖励邮件已发送');
        } catch (err) {
          console.error('[Yield] 材料异步处理失败:', err);
        }
      });
    }

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          const initialData = JSON.stringify({
            type: 'result',
            data: result,
          });
          controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

          const { system, user } = renderPrompt('yield-story', {
            cultivatorRealm: result.cultivatorRealm,
            cultivatorName: result.cultivatorName,
            amount: result.amount,
            expLine: result.expGain
              ? `2. 修为精进：【${result.expGain}】点。\n`
              : '',
            insightLine: result.insightGain
              ? `${result.expGain ? '3.' : '2.'} 道心感悟：【${result.insightGain}】点。\n`
              : '',
          });

          const aiStreamResult = stream_text(system, user, true);
          for await (const chunk of aiStreamResult.textStream) {
            const message = JSON.stringify({ type: 'chunk', text: chunk });
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          const errorMessage = JSON.stringify({
            type: 'error',
            error: '天机推演中断...',
          });
          controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
        } finally {
          controller.close();
          await redis.del(lockKey);
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    await redis.del(lockKey);
    throw error;
  }
});

inventoryRouter.get('/', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const type = c.req.query('type');
  if (type) {
    if (!['artifacts', 'materials', 'consumables'].includes(type)) {
      return c.json(
        {
          success: false,
          error: '无效的背包类型，仅支持 artifacts | materials | consumables',
        },
        400,
      );
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)),
    );

    let materialTypes: MaterialType[] | undefined;
    let excludeMaterialTypes: MaterialType[] | undefined;
    let materialRanks: Quality[] | undefined;
    let materialElements: ElementType[] | undefined;

    try {
      materialTypes = parseMaterialTypes(c.req.query('materialTypes') ?? null);
      excludeMaterialTypes = parseMaterialTypes(
        c.req.query('excludeMaterialTypes') ?? null,
      );
      materialRanks = parseMaterialRanks(c.req.query('materialRanks') ?? null);
      materialElements = parseMaterialElements(
        c.req.query('materialElements') ?? null,
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '材料类型参数解析失败',
        },
        400,
      );
    }

    const materialSortBy = c.req.query('materialSortBy');
    const materialSortOrder = c.req.query('materialSortOrder');
    const validSortBy = [
      'createdAt',
      'rank',
      'type',
      'element',
      'quantity',
      'name',
    ] as const;
    const validSortOrder = ['asc', 'desc'] as const;

    if (
      materialSortBy &&
      !validSortBy.includes(materialSortBy as (typeof validSortBy)[number])
    ) {
      return c.json(
        {
          success: false,
          error: `无效的排序字段，支持：${validSortBy.join(', ')}`,
        },
        400,
      );
    }
    if (
      materialSortOrder &&
      !validSortOrder.includes(
        materialSortOrder as (typeof validSortOrder)[number],
      )
    ) {
      return c.json(
        {
          success: false,
          error: `无效的排序方向，支持：${validSortOrder.join(', ')}`,
        },
        400,
      );
    }

    const result = await getPaginatedInventoryByType(user.id, cultivator.id, {
      type: type as 'artifacts' | 'materials' | 'consumables',
      page,
      pageSize,
      materialTypes,
      excludeMaterialTypes,
      materialRanks,
      materialElements,
      materialSortBy: materialSortBy as
        | 'createdAt'
        | 'rank'
        | 'type'
        | 'element'
        | 'quantity'
        | 'name'
        | undefined,
      materialSortOrder: materialSortOrder as 'asc' | 'desc' | undefined,
    });

    return c.json({
      success: true,
      data: result,
    });
  }

  const [consumableItems, materialItems, artifactItems] = await Promise.all([
    getCultivatorConsumables(user.id, cultivator.id),
    getCultivatorMaterials(user.id, cultivator.id),
    getCultivatorArtifacts(user.id, cultivator.id),
  ]);

  return c.json({
    success: true,
    data: {
      consumables: consumableItems,
      materials: materialItems,
      artifacts: artifactItems,
    },
  });
});

inventoryRouter.post('/discard', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  const { itemId, itemType } = DiscardSchema.parse(await c.req.json());
  let deleted = false;

  if (itemType === 'artifact') {
    const product = await creationProductRepository.findById(itemId);
    if (
      product &&
      product.cultivatorId === cultivator.id &&
      product.productType === 'artifact'
    ) {
      await creationProductRepository.deleteById(itemId);
      deleted = true;
    }
  } else if (itemType === 'consumable') {
    const result = await getExecutor()
      .delete(consumables)
      .where(
        and(
          eq(consumables.id, itemId),
          eq(consumables.cultivatorId, cultivator.id),
        ),
      )
      .returning();
    deleted = result.length > 0;
  } else {
    const result = await getExecutor()
      .delete(materials)
      .where(
        and(
          eq(materials.id, itemId),
          eq(materials.cultivatorId, cultivator.id),
        ),
      )
      .returning();
    deleted = result.length > 0;
  }

  if (!deleted) {
    return c.json({ success: false, error: '物品未找到或无法删除' }, 404);
  }

  return c.json({ success: true, message: '物品已丢弃' });
});

inventoryRouter.post('/identify', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { materialId } = IdentifySchema.parse(await c.req.json());
    const result = await identifyMysteryMaterial({
      materialId,
      cultivatorId: cultivator.id,
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof MarketServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '参数错误' }, 400);
    }
    console.error('Identify API error:', error);
    return c.json({ error: '鉴定失败' }, 500);
  }
});

mailRouter.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const pageRaw = parseInt(c.req.query('page') || '1', 10);
  const pageSizeRaw = parseInt(c.req.query('pageSize') || '20', 10);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSize = Number.isNaN(pageSizeRaw)
    ? 20
    : Math.min(100, Math.max(1, pageSizeRaw));
  const offset = (page - 1) * pageSize;

  const userMails = await getExecutor().query.mails.findMany({
    where: eq(mails.cultivatorId, cultivator.id),
    orderBy: [desc(mails.createdAt)],
    limit: pageSize + 1,
    offset,
  });
  const hasMore = userMails.length > pageSize;
  const pagedMails = hasMore ? userMails.slice(0, pageSize) : userMails;

  return c.json({
    mails: pagedMails,
    pagination: {
      page,
      pageSize,
      hasMore,
    },
  });
});

mailRouter.post('/claim', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { mailId } = ClaimMailSchema.parse(await c.req.json());
  const mail = await getExecutor().query.mails.findFirst({
    where: and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivator.id)),
  });

  if (!mail) {
    return c.json({ error: 'Mail not found' }, 404);
  }
  if (mail.isClaimed) {
    return c.json({ error: 'Already claimed' }, 400);
  }

  const attachments = (mail.attachments as MailAttachment[]) || [];
  if (attachments.length === 0) {
    return c.json({ message: 'No attachments' });
  }

  const gains: ResourceOperation[] = [];
  for (const item of attachments) {
    switch (item.type) {
      case 'spirit_stones':
        gains.push({ type: 'spirit_stones', value: item.quantity });
        break;
      case 'material':
        gains.push({
          type: 'material',
          value: item.quantity,
          data: item.data as Material,
        });
        break;
      case 'consumable':
        gains.push({
          type: 'consumable',
          value: item.quantity,
          data: item.data as Consumable,
        });
        break;
      case 'artifact':
        for (let i = 0; i < (item.quantity || 1); i++) {
          gains.push({
            type: 'artifact',
            value: 1,
            data: item.data as Artifact,
          });
        }
        break;
    }
  }

  const result = await resourceEngine.gain(
    user.id,
    cultivator.id,
    gains,
    async (tx: DbTransaction) => {
      await tx
        .update(mails)
        .set({ isClaimed: true, isRead: true })
        .where(eq(mails.id, mailId));
    },
  );

  if (!result.success) {
    return c.json({ error: result.errors?.[0] || '领取失败' }, 500);
  }
  return c.json({ success: true });
});

mailRouter.post('/claim-all', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const pendingMails = await getExecutor().query.mails.findMany({
    where: and(
      eq(mails.type, 'reward'),
      eq(mails.cultivatorId, cultivator.id),
      eq(mails.isClaimed, false),
    ),
  });

  const claimableMails = pendingMails.filter((mail) => {
    const attachments = (mail.attachments as MailAttachment[]) || [];
    return attachments.length > 0;
  });

  if (claimableMails.length === 0) {
    return c.json({ success: true, claimedCount: 0, claimedMailIds: [] });
  }

  const gains: ResourceOperation[] = [];
  const claimedMailIds = claimableMails.map((mail) => mail.id);
  for (const mail of claimableMails) {
    const attachments = (mail.attachments as MailAttachment[]) || [];
    for (const item of attachments) {
      switch (item.type) {
        case 'spirit_stones':
          gains.push({ type: 'spirit_stones', value: item.quantity });
          break;
        case 'material':
          gains.push({
            type: 'material',
            value: item.quantity,
            data: item.data as Material,
          });
          break;
        case 'consumable':
          gains.push({
            type: 'consumable',
            value: item.quantity,
            data: item.data as Consumable,
          });
          break;
        case 'artifact':
          for (let i = 0; i < (item.quantity || 1); i++) {
            gains.push({
              type: 'artifact',
              value: 1,
              data: item.data as Artifact,
            });
          }
          break;
      }
    }
  }

  const result = await resourceEngine.gain(
    user.id,
    cultivator.id,
    gains,
    async (tx: DbTransaction) => {
      await tx
        .update(mails)
        .set({ isClaimed: true, isRead: true })
        .where(inArray(mails.id, claimedMailIds));
    },
  );

  if (!result.success) {
    return c.json({ error: result.errors?.[0] || '一键领取失败' }, 500);
  }

  return c.json({
    success: true,
    claimedCount: claimedMailIds.length,
    claimedMailIds,
  });
});

mailRouter.post('/read', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { mailId } = ReadMailSchema.parse(await c.req.json());
  const mail = await getExecutor().query.mails.findFirst({
    where: and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivator.id)),
  });
  if (!mail) {
    return c.json({ error: 'Mail not found' }, 404);
  }

  await getExecutor()
    .update(mails)
    .set({ isRead: true })
    .where(eq(mails.id, mailId));
  return c.json({ success: true });
});

mailRouter.post('/read-all', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const updatedRows = await getExecutor()
    .update(mails)
    .set({ isRead: true })
    .where(and(eq(mails.cultivatorId, cultivator.id), eq(mails.isRead, false)))
    .returning({ id: mails.id });

  return c.json({ success: true, updatedCount: updatedRows.length });
});

mailRouter.get('/unread-count', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const result = await getExecutor()
    .select({ count: sql<number>`count(*)` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivator.id), eq(mails.isRead, false)));

  return c.json({ count: Number(result[0].count) });
});

skillsRouter.post('/forget', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { skillId } = ForgetSkillSchema.parse(await c.req.json());
  const deleted = await getExecutor()
    .delete(skills)
    .where(and(eq(skills.id, skillId), eq(skills.cultivatorId, cultivator.id)))
    .returning();

  if (!deleted || deleted.length === 0) {
    return c.json({ error: 'Skill not found or could not be deleted' }, 404);
  }

  return c.json({ success: true });
});

techniquesRouter.post('/forget', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { techniqueId } = ForgetTechniqueSchema.parse(await c.req.json());
  const deleted = await getExecutor()
    .delete(cultivationTechniques)
    .where(
      and(
        eq(cultivationTechniques.id, techniqueId),
        eq(cultivationTechniques.cultivatorId, cultivator.id),
      ),
    )
    .returning();

  if (!deleted || deleted.length === 0) {
    return c.json(
      { error: 'Technique not found or could not be deleted' },
      404,
    );
  }

  return c.json({ success: true });
});

router.route('/inventory', inventoryRouter);
router.route('/mail', mailRouter);
router.route('/skills', skillsRouter);
router.route('/techniques', techniquesRouter);

export default router;
