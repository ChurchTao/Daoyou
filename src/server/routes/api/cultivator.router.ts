import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  breakthroughHistory,
  consumables,
  cultivators,
  mails,
  materials,
  redeemCodeClaims,
  redeemCodes,
} from '@server/lib/drizzle/schema';
import {
  invalidateActiveCultivatorRef,
  requireActiveCultivator,
  requireActiveCultivatorRef,
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
import {
  createRedisLock,
  LockAcquisitionError,
  releaseRedisLock,
} from '@server/lib/redis/lock';
import { getRetreatLock } from '@server/lib/redis/retreatLock';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import { removeFromAllRankingRealmsExcept } from '@server/lib/redis/rankings';
import {
  consumeBodyCultivationBreakthroughCosts,
  getBodyCultivationBreakthroughReadiness,
} from '@server/lib/services/BodyCultivationBreakthroughService';
import { ConsumableUseEngine } from '@server/lib/services/ConsumableUseEngine';
import { ConditionService } from '@server/lib/services/ConditionService';
import { InnRecoveryService } from '@server/lib/services/InnRecoveryService';
import {
  commitPlayerStateMutation,
  type StateChangeDescriptor,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import {
  MailService,
  type MailAttachment,
} from '@server/lib/services/MailService';
import {
  identifyMysteryMaterial,
  MarketServiceError,
} from '@server/lib/services/MarketService';
import {
  PlayerMailServiceError,
  sendPlayerMail,
} from '@server/lib/services/PlayerMailService';
import { PillOperationExecutor } from '@server/lib/services/PillOperationExecutor';
import {
  QiInsufficientError,
  QiService,
  QiServiceError,
} from '@server/lib/services/QiService';
import { TaskService } from '@server/lib/services/TaskService';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  getCultivatorArtifacts,
  getCultivatorById,
  getCultivatorConsumables,
  getCultivatorMaterials,
  getLastDeadCultivatorSummary,
  getPaginatedInventoryByType,
  updateCultivationExp,
  updateCultivator,
  updateSpiritStones,
} from '@server/lib/services/cultivatorService';
import { stream_text } from '@server/utils/aiClient';
import {
  getOrInitCultivationProgress,
  stripExpCapForStorage,
} from '@server/utils/cultivationUtils';
import {
  getBreakthroughStoryPrompt,
  getLifespanExhaustedStoryPrompt,
  type BreakthroughStoryPayload,
  type LifespanExhaustedStoryPayload,
} from '@server/utils/prompts';
import { resolveRedeemCodeRewardAttachments } from '@server/lib/redeem/reward';
import { getRetreatQiCost } from '@shared/config/qiSystem';
import {
  BASE_ATTRIBUTE_TOTAL,
  BASE_ATTRIBUTE_VALUE,
  getRealmStageAttributeBudget,
} from '@shared/config/realmProgression';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import { isTalismanConsumable } from '@shared/lib/consumables';
import { attachmentsToResourceOperations } from '@shared/lib/itemLibrary';
import type {
  RetreatResultData,
  RetreatStreamEvent,
} from '@shared/contracts/retreat';
import type { BodyCultivationBreakthroughReadinessResponse } from '@shared/contracts/bodyCultivation';
import type {
  PlayerStateDomain,
  PlayerStateEvent,
} from '@shared/contracts/player';
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
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import type {
  BreakthroughHistoryEntry,
  CultivationProgress,
} from '@shared/types/cultivator';
import { randomUUID } from 'crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
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

const AttributeAllocationSchema = z.object({
  vitality: z.number().int().min(0).default(0),
  spirit: z.number().int().min(0).default(0),
  wisdom: z.number().int().min(0).default(0),
  speed: z.number().int().min(0).default(0),
  willpower: z.number().int().min(0).default(0),
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

const SendMailSchema = z.object({
  recipientCultivatorId: z.string().uuid(),
  content: z.string().trim().min(1).max(1000),
  attachment: z
    .object({
      itemType: z.enum(['material', 'artifact', 'consumable']),
      itemId: z.string().uuid(),
      quantity: z.number().int().min(1).default(1),
    })
    .optional(),
});

const ReadMailSchema = z.object({
  mailId: z.string(),
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

function qiErrorResponse(c: Context<AppEnv>, error: unknown) {
  if (error instanceof QiInsufficientError) {
    return c.json(
      {
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      409,
    );
  }
  if (error instanceof QiServiceError) {
    return jsonWithStatus(c, { error: error.message }, error.status);
  }
  return null;
}

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

function getRewardAffectedDomains(
  gains: ResourceOperation[],
): Set<PlayerStateDomain> {
  const domains = new Set<PlayerStateDomain>(['mail']);

  for (const gain of gains) {
    if (
      gain.type === 'material' ||
      gain.type === 'consumable' ||
      gain.type === 'artifact'
    ) {
      domains.add('inventory');
    }
    if (gain.type === 'artifact') {
      domains.add('products');
    }
    if (gain.type === 'spirit_stones' || gain.type === 'reputation') {
      domains.add('currency');
    }
    if (
      gain.type === 'cultivation_exp' ||
      gain.type === 'comprehension_insight'
    ) {
      domains.add('progress');
    }
  }

  return domains;
}

function buildMailStateChanges(args: {
  eventType: string;
  unreadMailCount: number;
  mailIds?: string[];
  gains?: ResourceOperation[];
  spiritStones?: number;
  reputation?: number;
  cultivationProgress?: unknown;
  realm?: RealmType;
  realmStage?: RealmStage;
}): StateChangeDescriptor[] {
  const gains = args.gains ?? [];
  const affectedDomains = getRewardAffectedDomains(gains);
  const changes: StateChangeDescriptor[] = [
    {
      domain: 'mail',
      eventType: args.eventType,
      patch: {
        unreadMailCount: args.unreadMailCount,
        ...(args.mailIds ? { mailIds: args.mailIds } : {}),
      },
      invalidates: ['mail'],
    },
  ];

  if (affectedDomains.has('inventory')) {
    changes.push({
      domain: 'inventory',
      eventType: 'inventory.changed',
      invalidates: ['inventory'],
    });
  }

  if (affectedDomains.has('products')) {
    changes.push({
      domain: 'products',
      eventType: 'products.changed',
      invalidates: ['products'],
    });
  }

  if (affectedDomains.has('currency')) {
    changes.push({
      domain: 'currency',
      eventType: 'currency.changed',
      patch:
        typeof args.spiritStones === 'number' ||
        typeof args.reputation === 'number'
          ? {
              currency: {
                ...(typeof args.spiritStones === 'number'
                  ? { spiritStones: args.spiritStones }
                  : {}),
                ...(typeof args.reputation === 'number'
                  ? { reputation: args.reputation }
                  : {}),
              },
            }
          : {},
    });
  }

  if (affectedDomains.has('progress')) {
    const progress =
      args.cultivationProgress && args.realm && args.realmStage
        ? getOrInitCultivationProgress(
            args.cultivationProgress as CultivationProgress,
            args.realm,
            args.realmStage,
          )
        : args.cultivationProgress;
    changes.push({
      domain: 'progress',
      eventType: 'progress.changed',
      patch: progress ? { progress } : {},
    });
  }

  return changes;
}

function buildArtifactEquipStateChanges(eventType: string): StateChangeDescriptor[] {
  return [
    {
      domain: 'products',
      eventType,
      invalidates: ['products'],
    },
    {
      domain: 'inventory',
      eventType: 'inventory.artifacts.changed',
      invalidates: ['inventory'],
    },
    {
      domain: 'profile',
      eventType: 'profile.products.changed',
      invalidates: ['profile'],
    },
  ];
}

function parsePositiveInt(
  rawValue: string | undefined,
  fallback: number,
): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function buildLifespanHistoryEntry(
  payload: LifespanExhaustedStoryPayload,
  story: string,
): BreakthroughHistoryEntry {
  return {
    from_realm: payload.summary.fromRealm,
    from_stage: payload.summary.fromStage,
    to_realm: payload.summary.fromRealm,
    to_stage: payload.summary.fromStage,
    age: payload.cultivator.age,
    years_spent: payload.summary.yearsSpent,
    story: story || undefined,
  };
}

type RetreatStorySource =
  | {
      type: 'breakthrough';
      payload: BreakthroughStoryPayload;
    }
  | {
      type: 'lifespan';
      payload: LifespanExhaustedStoryPayload;
    }
  | null;

function encodeSseEvent(
  encoder: TextEncoder,
  event: RetreatStreamEvent,
): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function createRetreatStreamResponse(args: {
  result: RetreatResultData;
  stateEvents?: PlayerStateEvent[];
  storySource: RetreatStorySource;
  onStoryComplete?: (story: string) => Promise<void> | void;
}): Response {
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encodeSseEvent(encoder, {
          type: 'result',
          data: args.result,
        }),
      );
      if (args.stateEvents?.length) {
        controller.enqueue(
          encodeSseEvent(encoder, {
            type: 'state',
            events: args.stateEvents,
          }),
        );
      }

      if (!args.storySource) {
        controller.close();
        return;
      }

      let accumulatedStory = '';

      try {
        const prompt =
          args.storySource.type === 'breakthrough'
            ? getBreakthroughStoryPrompt(args.storySource.payload)
            : getLifespanExhaustedStoryPrompt(args.storySource.payload);
        const aiStreamResult = stream_text(prompt[0], prompt[1], true, false, {
          sceneId:
            args.storySource.type === 'breakthrough'
              ? 'breakthrough-story'
              : 'lifespan-exhausted',
        });

        for await (const chunk of aiStreamResult.textStream) {
          accumulatedStory += chunk;
          controller.enqueue(
            encodeSseEvent(encoder, {
              type: 'chunk',
              text: chunk,
            }),
          );
        }
      } catch (error) {
        console.error('Retreat story stream error:', error);
        controller.enqueue(
          encodeSseEvent(encoder, {
            type: 'error',
            error: '天机推演中断，此番结果已然落定。',
          }),
        );
      } finally {
        try {
          await args.onStoryComplete?.(accumulatedStory);
        } catch (persistError) {
          console.error('Retreat story persist error:', persistError);
        }
        controller.close();
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
}

const router = new Hono<AppEnv>();
const inventoryRouter = new Hono<AppEnv>();
const mailRouter = new Hono<AppEnv>();

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
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
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

  await invalidateActiveCultivatorRef(user.id);

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
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'consumable_use',
      run: async (tx) => {
        const result = await ConsumableUseEngine.consume(
          user.id,
          cultivator.id,
          parsed.data.consumableId,
          { tx },
        );
        const [cultivatorState] = await tx
          .select({
            condition: cultivators.condition,
            cultivationProgress: cultivators.cultivation_progress,
            spiritStones: cultivators.spirit_stones,
            qi: cultivators.qi,
            lifespan: cultivators.lifespan,
            vitality: cultivators.vitality,
            spirit: cultivators.spirit,
            wisdom: cultivators.wisdom,
            speed: cultivators.speed,
            willpower: cultivators.willpower,
          })
          .from(cultivators)
          .where(eq(cultivators.id, cultivator.id))
          .limit(1);

        const changes: StateChangeDescriptor[] = [
          {
            domain: 'inventory',
            eventType: 'inventory.consumable.used',
            invalidates: ['inventory'],
          },
          {
            domain: 'tasks',
            eventType: 'tasks.maybe_changed',
            invalidates: ['tasks'],
          },
        ];

        if (isTalismanConsumable(result.consumable)) {
          changes.push({
            domain: 'currency',
            eventType: 'currency.qi.changed',
            patch: {
              currency: {
                spiritStones: cultivatorState?.spiritStones,
                qi: cultivatorState?.qi,
              },
            },
          });
        } else {
          changes.push(
            {
              domain: 'condition',
              eventType: 'condition.consumable.changed',
              patch: { condition: cultivatorState?.condition ?? {} },
            },
            {
              domain: 'progress',
              eventType: 'progress.consumable.changed',
              patch: { progress: cultivatorState?.cultivationProgress ?? {} },
            },
            {
              domain: 'profile',
              eventType: 'profile.consumable.changed',
              invalidates: ['profile'],
            },
          );
        }

        return {
          result: {
            message: result.message,
            consumable: result.consumable,
          },
          changes,
        };
      },
    });
    try {
      await TaskService.syncCultivatorTasks(cultivator.id);
    } catch (syncError) {
      console.error('使用消耗品后同步任务失败:', syncError);
    }
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const qiResponse = qiErrorResponse(c, error);
    if (qiResponse) return qiResponse;
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '使用失败',
      },
      400,
    );
  }
});

router.post('/inn-recovery', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('cultivator');
  if (!user || !activeCultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const cultivator = await getCultivatorById(user.id, activeCultivator.id);
  if (!cultivator) {
    return c.json({ success: false, error: '角色不存在' }, 404);
  }

  const recovery = InnRecoveryService.buildRecoveryResult(cultivator);
  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: activeCultivator.id,
    source: 'inn_recovery',
    run: async (tx) => {
      const [updatedCultivator] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} - ${recovery.spiritStoneCost}`,
          cultivation_progress: stripExpCapForStorage(recovery.nextCultivationProgress),
          condition: recovery.nextCondition,
        })
        .where(
          and(
            eq(cultivators.id, activeCultivator.id),
            sql`${cultivators.spirit_stones} >= ${recovery.spiritStoneCost}`,
          ),
        )
        .returning({
          spiritStones: cultivators.spirit_stones,
        });

      if (!updatedCultivator) {
        throw new Error(
          `囊中羞涩，灵石不足（至少需要 ${recovery.spiritStoneCost} 灵石）`,
        );
      }

      return {
        result: {
          cultivator: {
            ...cultivator,
            spirit_stones: updatedCultivator.spiritStones,
            cultivation_progress: recovery.nextCultivationProgress,
            condition: recovery.nextCondition,
          },
          spiritStoneCost: recovery.spiritStoneCost,
          cultivationLossPercent: recovery.cultivationLossPercent,
          cultivationLossAmount: recovery.cultivationLossAmount,
          clearedStatusCount: recovery.clearedStatusCount,
        },
        changes: [
          {
            domain: 'condition' as const,
            eventType: 'condition.recovered',
            patch: { condition: recovery.nextCondition },
          },
          {
            domain: 'currency' as const,
            eventType: 'currency.spirit_stones.changed',
            patch: {
              currency: {
                spiritStones: updatedCultivator.spiritStones,
                qi: activeCultivator.qi,
              },
            },
          },
          {
            domain: 'progress' as const,
            eventType: 'progress.inn_recovery_adjusted',
            patch: { progress: recovery.nextCultivationProgress },
          },
        ],
      };
    },
  }).catch((error) => {
    if (
      error instanceof Error &&
      error.message.startsWith('囊中羞涩，灵石不足')
    ) {
      return null;
    }
    throw error;
  });

  if (!committed) {
    return c.json(
      {
        success: false,
        error: `囊中羞涩，灵石不足（至少需要 ${recovery.spiritStoneCost} 灵石）`,
      },
      400,
    );
  }

  return c.json(toPlayerStateMutationResponse(committed));
});

router.get('/body-cultivation/breakthrough', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('cultivator');
  if (!user || !activeCultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const cultivator = await getCultivatorById(user.id, activeCultivator.id);
  if (!cultivator) {
    return c.json({ success: false, error: '角色不存在' }, 404);
  }

  const readiness = getBodyCultivationBreakthroughReadiness(cultivator);
  const response: BodyCultivationBreakthroughReadinessResponse = {
    success: true,
    data: {
      nextRealm: readiness.nextRealm,
      canAttempt: readiness.canAttempt,
      successChance: readiness.successChance,
      guaranteeProgress: readiness.guaranteeProgress,
      failedAttempts: readiness.failedAttempts,
      ruleRequirements: readiness.ruleRequirements,
      inventoryRequirements: readiness.inventoryRequirements,
    },
  };

  return c.json(response);
});

router.post('/body-cultivation/breakthrough', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('cultivator');
  if (!user || !activeCultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const cultivator = await getCultivatorById(user.id, activeCultivator.id);
  if (!cultivator) {
    return c.json({ success: false, error: '角色不存在' }, 404);
  }

  try {
    const readiness = getBodyCultivationBreakthroughReadiness(cultivator);
    const missingRuleRequirements = readiness.ruleRequirements.filter(
      (requirement) => !requirement.met,
    );
    const missingInventoryRequirements = readiness.inventoryRequirements.filter(
      (requirement) => !requirement.met,
    );
    if (!readiness.canAttempt) {
      return c.json(
        {
          success: false,
          error: [
            ...missingRuleRequirements.map((requirement) => requirement.label),
            ...missingInventoryRequirements.map(
              (requirement) =>
                `${requirement.label ?? requirement.name} ${requirement.ownedQuantity}/${requirement.quantity}`,
            ),
          ].join('、') || '肉身进阶条件不足',
          data: {
            nextRealm: readiness.nextRealm,
            ruleRequirements: readiness.ruleRequirements,
            inventoryRequirements: readiness.inventoryRequirements,
          },
        },
        400,
      );
    }

    const result = ConditionService.breakthroughBodyCultivationRealm(
      cultivator,
      cultivator.condition,
    );
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: activeCultivator.id,
      source: 'body_cultivation_breakthrough',
      run: async (tx) => {
        await consumeBodyCultivationBreakthroughCosts(
          user.id,
          activeCultivator.id,
          readiness.costPlan,
          tx,
        );
        const saved = await updateCultivator(
          activeCultivator.id,
          {
            condition: result.condition,
          },
          tx,
        );

        if (!saved) {
          throw new Error('更新角色数据失败');
        }

        return {
          result: {
            success: result.success,
            fromRealm: result.fromRealm,
            toRealm: result.toRealm,
            chance: result.chance,
            roll: result.roll,
            failedAttempts: result.failedAttempts,
            guaranteeProgress: result.guaranteeProgress,
            condition: result.condition,
          },
          changes: [
            {
              domain: 'condition' as const,
              eventType: result.success
                ? 'condition.body_cultivation.breakthrough'
                : 'condition.body_cultivation.breakthrough_failed',
              patch: { condition: result.condition },
            },
            {
              domain: 'inventory' as const,
              eventType: 'inventory.body_cultivation.breakthrough_consumed',
              invalidates: ['inventory'],
            },
          ],
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '肉身进阶失败',
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
  const product = await creationProductRepository.findById(artifactId);
  if (
    !product ||
    product.cultivatorId !== cultivator.id ||
    product.productType !== 'artifact'
  ) {
    return c.json({ error: '装备不存在或无权限操作' }, 404);
  }

  const slot = product.slot || 'weapon';
  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'artifact_equip',
    run: async (tx) => {
      if (product.isEquipped) {
        await creationProductRepository.unequipArtifact(artifactId, tx);
      } else {
        await creationProductRepository.equipArtifact(
          artifactId,
          cultivator.id,
          slot,
          tx,
        );
      }

      const equippedArtifacts =
        await creationProductRepository.findEquippedArtifacts(cultivator.id, tx);
      const equippedItems = {
        weapon:
          equippedArtifacts.find((item) => item.slot === 'weapon')?.id ?? null,
        armor:
          equippedArtifacts.find((item) => item.slot === 'armor')?.id ?? null,
        accessory:
          equippedArtifacts.find((item) => item.slot === 'accessory')?.id ?? null,
      };

      return {
        result: equippedItems,
        changes: buildArtifactEquipStateChanges('products.artifact.equipped'),
      };
    },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

router.get('/qi', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const data = await QiService.getQiState(ref.cultivatorId);
    return c.json({ success: true, data });
  } catch (error) {
    const qiResponse = qiErrorResponse(c, error);
    if (qiResponse) return qiResponse;
    console.error('获取灵气状态失败:', error);
    return c.json({ error: '获取灵气状态失败' }, 500);
  }
});

router.get('/qi/logs', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const page = parsePositiveInt(c.req.query('page'), 1);
  const pageSize = Math.min(
    100,
    parsePositiveInt(c.req.query('pageSize'), 20),
  );
  const data = await QiService.listLogs(cultivator.id, { page, pageSize });
  return c.json({ success: true, data });
});

router.post('/title', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { title } = TitleSchema.parse(await c.req.json());
  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'profile_title',
    run: async (tx) => {
      const updated = await tx
        .update(cultivators)
        .set({ title: title || null })
        .where(eq(cultivators.id, cultivator.id))
        .returning();

      return {
        result: updated[0],
        changes: [
          {
            domain: 'profile',
            eventType: 'profile.title.changed',
            invalidates: ['profile'],
          },
        ],
      };
    },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

router.post('/attributes/allocate', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const parsed = AttributeAllocationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const delta = parsed.data;
  const spent =
    delta.vitality +
    delta.spirit +
    delta.wisdom +
    delta.speed +
    delta.willpower;
  if (spent <= 0) {
    return c.json({ error: '请选择要分配的属性点' }, 400);
  }

  const lockKey = `cultivator:attributes:allocate:lock:${cultivator.id}`;
  const lock = createRedisLock({
    retries: 0,
    delay: 50,
  });
  let lockAcquired = false;

  try {
    await lock.acquire(lockKey);
    lockAcquired = true;
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'profile_attribute_allocate',
      run: async (tx) => {
        const [current] = await tx
          .select({
            id: cultivators.id,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
            vitality: cultivators.vitality,
            spirit: cultivators.spirit,
            wisdom: cultivators.wisdom,
            speed: cultivators.speed,
            willpower: cultivators.willpower,
            unallocatedAttributePoints:
              cultivators.unallocatedAttributePoints,
          })
          .from(cultivators)
          .where(eq(cultivators.id, cultivator.id));

        if (!current) {
          throw new Error('角色不存在');
        }

        if (spent > current.unallocatedAttributePoints) {
          throw new Error('未分配属性点不足');
        }

        const nextAttributes = {
          vitality: current.vitality + delta.vitality,
          spirit: current.spirit + delta.spirit,
          wisdom: current.wisdom + delta.wisdom,
          speed: current.speed + delta.speed,
          willpower: current.willpower + delta.willpower,
        };
        const values = Object.values(nextAttributes);
        if (values.some((value) => value < BASE_ATTRIBUTE_VALUE)) {
          throw new Error('属性不能低于基础值');
        }

        const budget = getRealmStageAttributeBudget(
          current.realm as RealmType,
          current.realmStage as RealmStage,
        );
        const totalAttributes = values.reduce((sum, value) => sum + value, 0);
        const allocatedPoints = totalAttributes - BASE_ATTRIBUTE_TOTAL;
        if (allocatedPoints > budget - BASE_ATTRIBUTE_TOTAL) {
          throw new Error('属性总点数超过当前境界预算');
        }

        const [updated] = await tx
          .update(cultivators)
          .set({
            ...nextAttributes,
            unallocatedAttributePoints:
              current.unallocatedAttributePoints - spent,
          })
          .where(eq(cultivators.id, cultivator.id))
          .returning({
            vitality: cultivators.vitality,
            spirit: cultivators.spirit,
            wisdom: cultivators.wisdom,
            speed: cultivators.speed,
            willpower: cultivators.willpower,
            unallocated_attribute_points:
              cultivators.unallocatedAttributePoints,
          });
        const result = {
          attributes: {
            vitality: updated.vitality,
            spirit: updated.spirit,
            wisdom: updated.wisdom,
            speed: updated.speed,
            willpower: updated.willpower,
          },
          unallocated_attribute_points: updated.unallocated_attribute_points,
        };

        return {
          result,
          changes: [
            {
              domain: 'profile',
              eventType: 'profile.attributes.allocated',
              patch: result,
              invalidates: ['profile'],
            },
          ],
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof LockAcquisitionError) {
      return c.json({ error: '属性分配正在处理中，请稍后' }, 429);
    }
    const message = error instanceof Error ? error.message : '属性分配失败';
    if (
      [
        '角色不存在',
        '未分配属性点不足',
        '属性不能低于基础值',
        '属性总点数超过当前境界预算',
      ].includes(message)
    ) {
      return c.json({ error: message }, message === '角色不存在' ? 404 : 400);
    }
    throw error;
  } finally {
    if (lockAcquired) {
      await releaseRedisLock(lock, lockKey);
    }
  }
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

  try {
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'redeem_code_claim',
      run: async (tx) => {
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

        let rewardAttachments: MailAttachment[] = [];
        try {
          rewardAttachments = resolveRedeemCodeRewardAttachments(redeemCode);
        } catch (error) {
          throw new RedeemClaimError(
            error instanceof Error ? error.message : '兑换码已失效',
          );
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
          rewardAttachments,
          'reward',
          tx,
        );

        await tx.insert(redeemCodeClaims).values({
          redeemCodeId: redeemCode.id,
          userId: user.id,
          cultivatorId: cultivator.id,
          mailId: mail.id,
        });

        const unreadMailCount = await countUnreadMail(cultivator.id, tx);

        return {
          result: {
            message: '兑换成功，奖励已通过传音玉简发放',
            mailId: mail.id,
          },
          changes: [
            {
              domain: 'mail',
              eventType: 'mail.redeem_code.created',
              patch: { unreadMailCount },
              invalidates: ['mail'],
            },
          ],
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
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
});

router.post('/retreat', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('cultivator');
  if (!user || !activeCultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const retreatLock = getRetreatLock();
  const cultivatorId = activeCultivator.id;
  let years = 0;
  let lockAcquired = false;
  let qiAfter: number | null = null;

  try {
    const { years: inputYears, action } = RetreatSchema.parse(
      await c.req.json(),
    );
    years = inputYears ?? 0;

    lockAcquired = await retreatLock.acquire(cultivatorId);
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

      const cultivateQiActionInstanceId = randomUUID();
      const result = performCultivation(cultivator, years);

      let streamResult: RetreatResultData = {
        summary: result.summary,
        action: 'cultivate',
      };
      let storySource: RetreatStorySource = null;
      let lifespanStoryPayload: LifespanExhaustedStoryPayload | null = null;
      let afterCommit: (() => Promise<void>) | undefined;

      const committed = await commitPlayerStateMutation({
        userId: user.id,
        cultivatorId,
        source: 'retreat_cultivate',
        run: async (tx) => {
          const qiReservation = await QiService.reserveQi({
            cultivatorId,
            action: 'retreat_10_years',
            actionInstanceId: cultivateQiActionInstanceId,
            cost: getRetreatQiCost(years),
            metadata: {
              years,
              retreatAction: action,
            },
            tx,
          });
          qiAfter =
            typeof qiReservation?.qiAfter === 'number'
              ? qiReservation.qiAfter
              : null;

          await addRetreatRecord(user.id, cultivatorId, result.record, tx);

          const saved = await updateCultivator(cultivatorId, {
            age: result.cultivator.age,
            closed_door_years_total: result.cultivator.closed_door_years_total,
            cultivation_progress: result.cultivator.cultivation_progress,
            condition: result.cultivator.condition,
          }, tx);

          if (!saved) {
            throw new Error('更新角色数据失败');
          }

          await QiService.commitReservation({
            actionInstanceId: cultivateQiActionInstanceId,
            metadata: { committedAt: new Date().toISOString() },
            tx,
          });

          try {
            const lifespanResult = await consumeLifespanAndHandleDepletion(
              cultivatorId,
              years,
              {
                executor: tx,
                deferSideEffects: true,
                ageAfterConsumption: result.cultivator.age,
              },
            );
            if (lifespanResult.depleted) {
              streamResult = {
                ...streamResult,
                storyType: lifespanResult.storyPayload ? 'lifespan' : null,
                depleted: true,
              };
              storySource = lifespanResult.storyPayload
                ? {
                    type: 'lifespan',
                    payload: lifespanResult.storyPayload,
                  }
                : null;
              lifespanStoryPayload =
                storySource?.type === 'lifespan' ? storySource.payload : null;
              afterCommit = lifespanResult.afterCommit;
            }
          } catch (error) {
            console.warn('处理寿元耗尽失败：', error);
          }

          const changes: StateChangeDescriptor[] = [
            {
              domain: 'profile',
              eventType: 'profile.retreat.changed',
              invalidates: ['profile'],
            },
            {
              domain: 'progress',
              eventType: 'progress.cultivation.changed',
              patch: {
                progress: result.cultivator.cultivation_progress,
              },
            },
            {
              domain: 'condition',
              eventType: 'condition.retreat.changed',
              patch: { condition: result.cultivator.condition },
            },
            {
              domain: 'currency',
              eventType: 'currency.qi.spent',
              patch: qiAfter === null ? {} : { currency: { qi: qiAfter } },
            },
          ];
          if (streamResult.depleted) {
            changes.push({
              domain: 'condition',
              eventType: 'condition.lifespan.depleted',
              invalidates: ['condition'],
            });
          }

          return {
            result: streamResult,
            changes,
          };
        },
      });

      if (afterCommit) {
        try {
          await afterCommit();
        } catch (error) {
          console.error('闭关寿元耗尽后置副作用失败:', error);
        }
      }

      return createRetreatStreamResponse({
        result: committed.result,
        stateEvents: committed.state.events,
        storySource,
        onStoryComplete: async (story) => {
          if (!lifespanStoryPayload) {
            return;
          }

          await addBreakthroughHistoryEntry(
            user.id,
            cultivatorId,
            buildLifespanHistoryEntry(lifespanStoryPayload, story),
          );
        },
      });
    }

    const majorGate = await TaskService.getMajorBreakthroughGate(cultivatorId);
    if (majorGate.required && majorGate.blocked) {
      return c.json(
        {
          success: false,
          error: '大境界突破仍需先完成破境任务',
          errorCode: 'MAJOR_BREAKTHROUGH_TASK_REQUIRED',
          data: {
            task: majorGate.task,
          },
        },
        409,
      );
    }

    const breakthroughQiActionInstanceId = randomUUID();

    const result = attemptBreakthrough(cultivator);
    result.cultivator.condition =
      PillOperationExecutor.consumeBreakthroughSupportStatuses(
        result.cultivator.condition,
        result.cultivator,
      );
    const storySource: RetreatStorySource = result.summary.success
      ? {
          type: 'breakthrough',
          payload: {
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
              attributePointReward: result.summary.attributePointReward,
              lifespanDepleted: false,
              modifiers: result.summary.modifiers,
            },
          },
        }
      : null;

    const isMajorBreakthrough =
      result.summary.success &&
      result.summary.toRealm &&
      result.summary.toRealm !== result.summary.fromRealm;
    const sendBreakthroughRumor = isMajorBreakthrough
      ? async () => {
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
      : null;

    const retreatResult: RetreatResultData = {
        summary: result.summary,
        storyType: storySource ? 'breakthrough' : null,
        action: 'breakthrough',
    };
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId,
      source: 'retreat_breakthrough',
      run: async (tx) => {
        const qiReservation = await QiService.reserveQi({
          cultivatorId,
          action: 'breakthrough_attempt',
          actionInstanceId: breakthroughQiActionInstanceId,
          metadata: {
            retreatAction: action,
          },
          tx,
        });
        qiAfter =
          typeof qiReservation?.qiAfter === 'number'
            ? qiReservation.qiAfter
            : null;

        const saved = await updateCultivator(cultivatorId, {
          realm: result.cultivator.realm,
          realm_stage: result.cultivator.realm_stage,
          age: result.cultivator.age,
          lifespan: result.cultivator.lifespan,
          attributes: result.cultivator.attributes,
          unallocated_attribute_points:
            result.cultivator.unallocated_attribute_points,
          cultivation_progress: result.cultivator.cultivation_progress,
          condition: result.cultivator.condition,
        }, tx);

        if (!saved) {
          throw new Error('更新角色数据失败');
        }

        if (result.summary.success) {
          await QiService.commitReservation({
            actionInstanceId: breakthroughQiActionInstanceId,
            metadata: { committedAt: new Date().toISOString() },
            tx,
          });
        } else {
          await QiService.markNoRefund({
            actionInstanceId: breakthroughQiActionInstanceId,
            reason: 'breakthrough_failed_normally',
            metadata: { committedAt: new Date().toISOString() },
            tx,
          });
        }

        return {
          result: retreatResult,
          changes: [
            {
              domain: 'profile',
              eventType: 'profile.breakthrough.changed',
              invalidates: ['profile'],
            },
            {
              domain: 'condition',
              eventType: 'condition.breakthrough.changed',
              patch: { condition: result.cultivator.condition },
            },
            {
              domain: 'progress',
              eventType: 'progress.breakthrough.changed',
              patch: {
                progress: result.cultivator.cultivation_progress,
              },
            },
            {
              domain: 'currency',
              eventType: 'currency.qi.spent',
              patch: qiAfter === null ? {} : { currency: { qi: qiAfter } },
            },
          ],
        };
      },
    });

    if (sendBreakthroughRumor) {
      await sendBreakthroughRumor();
    }

    if (isMajorBreakthrough) {
      try {
        await removeFromAllRankingRealmsExcept(
          cultivatorId,
          result.summary.toRealm as RealmType,
        );
      } catch (rankingError) {
        console.error('大境界突破后清理天骄榜旧境界失败:', rankingError);
      }
    }

    return createRetreatStreamResponse({
      result: committed.result,
      stateEvents: committed.state.events,
      storySource,
      onStoryComplete: async (story) => {
        if (!result.summary.success || !result.historyEntry) {
          return;
        }

        if (story) {
          result.historyEntry.story = story;
        }

        await addBreakthroughHistoryEntry(
          user.id,
          cultivatorId,
          result.historyEntry,
        );
      },
    });
  } catch (err) {
    const qiResponse = qiErrorResponse(c, err);
    if (qiResponse) return qiResponse;
    console.error('闭关突破 API 错误:', err);
    throw err;
  } finally {
    if (lockAcquired && cultivatorId) {
      try {
        await retreatLock.release(cultivatorId);
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

    const committed = await commitPlayerStateMutation({
      userId,
      cultivatorId,
      source: 'yield_claim',
      run: async (tx) => {
        let nextSpiritStones = fullCultivator.spirit_stones;
        let nextCultivationProgress = fullCultivator.cultivation_progress;
        const claimedAt = new Date();
        for (const gain of operations) {
          switch (gain.type) {
            case 'spirit_stones':
              nextSpiritStones = await updateSpiritStones(
                userId,
                cultivatorId,
                gain.value,
                tx,
              );
              break;
            case 'cultivation_exp':
              nextCultivationProgress = await updateCultivationExp(
                userId,
                cultivatorId,
                gain.value,
                undefined,
                tx,
              );
              break;
            case 'comprehension_insight':
              nextCultivationProgress = await updateCultivationExp(
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

        await tx
          .update(cultivators)
          .set({ last_yield_at: claimedAt })
          .where(eq(cultivators.id, cultivatorId));

        return {
          result,
          changes: [
            {
              domain: 'profile',
              eventType: 'profile.yield.changed',
              patch: { last_yield_at: claimedAt.toISOString() },
            },
            {
              domain: 'currency',
              eventType: 'currency.yield.gained',
              patch: {
                currency: {
                  spiritStones: nextSpiritStones,
                  qi: activeCultivator.qi,
                  qiLastRefreshedAt:
                    activeCultivator.qiLastRefreshedAt?.toISOString?.() ??
                    null,
                },
              },
            },
            {
              domain: 'progress',
              eventType: 'progress.yield.gained',
              patch: { progress: nextCultivationProgress },
            },
          ],
        };
      },
    });

    // 异步生成材料并发送邮件，带重试与 fallback 兜底，避免灵材永久丢失
    if (materialCount > 0) {
      runDetached(async () => {
        const MAX_MAIL_RETRIES = 3;
        const qualityChanceMap =
          YieldCalculator.getMaterialQualityChanceMap(realm);

        // 1. 生成材料（MaterialGenerator 内部已有 LLM 失败 → fallbackPresets 兜底）
        let generatedMaterials: GeneratedMaterial[];
        try {
          console.log(
            `[Yield] 开始异步生成材料: cultivatorId=${cultivatorId}, count=${materialCount}`,
          );
          generatedMaterials = await MaterialGenerator.generateRandom(
            materialCount,
            { qualityChanceMap },
          );
          console.log(
            `[Yield] 材料生成完成: ${generatedMaterials.map((m) => `${m.rank}${m.name}`).join(', ')}`,
          );
        } catch (err) {
          console.error('[Yield] 材料生成异常:', err);
          generatedMaterials = [];
        }

        if (generatedMaterials.length === 0) {
          console.error(
            `[Yield] 材料生成结果为空，跳过空奖励邮件: cultivatorId=${cultivatorId}, expected=${materialCount}`,
          );
          return;
        }

        // 2. 构建附件并发送邮件（带指数退避重试）
        const attachments: MailAttachment[] = generatedMaterials.map(
          (material) => ({
            type: 'material' as const,
            name: material.name,
            quantity: material.quantity,
            data: material,
          }),
        );

        for (let attempt = 1; attempt <= MAX_MAIL_RETRIES; attempt++) {
          try {
            await commitPlayerStateMutation({
              userId,
              cultivatorId,
              source: 'yield_material_mail',
              run: async (tx) => {
                await MailService.sendMail(
                  cultivatorId,
                  '历练机缘',
                  '道友历练途中，偶得天材地宝，特以此传音玉简送达。',
                  attachments,
                  'reward',
                  tx,
                );
                return {
                  result: null,
                  changes: [
                    {
                      domain: 'mail',
                      eventType: 'mail.yield_material.created',
                      invalidates: ['mail'],
                    },
                  ],
                };
              },
            });
            console.log('[Yield] 材料奖励邮件已发送');
            return; // 成功，退出
          } catch (mailErr) {
            if (attempt < MAX_MAIL_RETRIES) {
              const delay = attempt * 3000;
              console.error(
                `[Yield] 邮件发送第 ${attempt} 次失败，${delay / 1000}s 后重试:`,
                mailErr,
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              console.error(
                `[Yield] 邮件发送 ${MAX_MAIL_RETRIES} 次均失败，灵材可能丢失:`,
                mailErr,
              );
            }
          }
        }
      });
    }

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          const initialData = JSON.stringify({
            type: 'result',
            data: committed.result,
          });
          controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));
          if (committed.state.events.length > 0) {
            const stateData = JSON.stringify({
              type: 'state',
              state: committed.state,
            });
            controller.enqueue(encoder.encode(`data: ${stateData}\n\n`));
          }

          const { system, user } = renderPrompt('yield-story', {
            cultivatorRealm: result.cultivatorRealm,
            cultivatorName: result.cultivatorName,
            amount: result.amount,
            extraYieldText: (() => {
              const extra = [
                result.expGain ? `修为精进 ${result.expGain} 点` : '',
                result.insightGain
                  ? `${getGameConceptLabel('comprehension_insight')} ${result.insightGain} 点`
                  : '',
              ]
                .filter(Boolean)
                .join('；');
              return extra ? `；${extra}` : '';
            })(),
          });

          const aiStreamResult = stream_text(system, user, true, false, {
            sceneId: 'yield-story',
          });
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

inventoryRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const ref = c.get('activeCultivatorRef');
  if (!user || !ref) {
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

    const result = await getPaginatedInventoryByType(user.id, ref.cultivatorId, {
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
    getCultivatorConsumables(user.id, ref.cultivatorId),
    getCultivatorMaterials(user.id, ref.cultivatorId),
    getCultivatorArtifacts(user.id, ref.cultivatorId),
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
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const { itemId, itemType } = DiscardSchema.parse(await c.req.json());

  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'inventory_discard',
    run: async (tx) => {
      let deleted = false;

      if (itemType === 'artifact') {
        const product = await creationProductRepository.findById(itemId, tx);
        if (
          product &&
          product.cultivatorId === cultivator.id &&
          product.productType === 'artifact'
        ) {
          await creationProductRepository.deleteById(itemId, tx);
          deleted = true;
        }
      } else if (itemType === 'consumable') {
        const result = await tx
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
        const result = await tx
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
        throw new MarketServiceError(404, '物品未找到或无法删除');
      }

      const changes: StateChangeDescriptor[] = [
        {
          domain: 'inventory',
          eventType: 'inventory.discarded',
          invalidates: ['inventory'],
        },
      ];
      if (itemType === 'artifact') {
        changes.push({
          domain: 'products',
          eventType: 'products.artifact.discarded',
          invalidates: ['products'],
        });
      }

      return {
        result: { message: '物品已丢弃' },
        changes,
      };
    },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

inventoryRouter.post('/identify', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { materialId } = IdentifySchema.parse(await c.req.json());
    let afterCommit: (() => Promise<void>) | undefined;
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'inventory_identify',
      run: async (tx) => {
        const { afterCommit: identifyAfterCommit, ...result } =
          await identifyMysteryMaterial({
          materialId,
          cultivatorId: cultivator.id,
          tx,
          deferSideEffects: true,
        });
        afterCommit = identifyAfterCommit;
        return {
          result,
          changes: [
            {
              domain: 'inventory',
              eventType: 'inventory.material.identified',
              invalidates: ['inventory'],
            },
            {
              domain: 'currency',
              eventType: 'currency.changed',
              patch:
                typeof result.qiAfter === 'number'
                  ? {
                      currency: {
                        qi: result.qiAfter,
                      },
                    }
                  : undefined,
              invalidates: ['currency'],
            },
          ],
        };
      },
    });
    if (afterCommit) {
      try {
        await afterCommit();
      } catch (error) {
        console.error('鉴定后置副作用失败:', error);
      }
    }
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const qiResponse = qiErrorResponse(c, error);
    if (qiResponse) {
      return qiResponse;
    }
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

mailRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
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
    where: eq(mails.cultivatorId, ref.cultivatorId),
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

mailRouter.post('/send', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const parsed = SendMailSchema.parse(await c.req.json());
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'player_mail_send',
      run: async (tx) => {
        const result = await sendPlayerMail({
          senderCultivatorId: cultivator.id,
          senderName: cultivator.name,
          recipientCultivatorId: parsed.recipientCultivatorId,
          content: parsed.content,
          attachment: parsed.attachment,
          tx,
        });

        const changes: StateChangeDescriptor[] = [
          {
            domain: 'inventory',
            eventType: 'inventory.mail.sent',
            invalidates: ['inventory'],
          },
        ];
        if (parsed.attachment?.itemType === 'artifact') {
          changes.push({
            domain: 'products',
            eventType: 'products.mail.sent',
            invalidates: ['products'],
          });
        }

        return {
          result: {
            message: `已向${result.recipientName}发出传音`,
            attachmentCount: result.attachmentCount,
          },
          changes,
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }
    if (error instanceof PlayerMailServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('mail send api error:', error);
    return c.json({ error: '发送传音失败' }, 500);
  }
});

mailRouter.post('/claim', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { mailId } = ClaimMailSchema.parse(await c.req.json());

  // [安全] 分布式锁防止同一邮件被并发领取
  const claimLockKey = `mail:claim:lock:${mailId}`;
  const acquiredLock = await redis.set(claimLockKey, 'locked', 'EX', 10, 'NX');
  if (!acquiredLock) {
    return c.json({ error: '领取正在处理中，请稍后' }, 429);
  }

  try {
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

    const gains = attachmentsToResourceOperations(attachments);

    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'mail_claim',
      run: async (tx) => {
        const result = await resourceEngine.gainInTransaction(
          user.id,
          cultivator.id,
          gains,
          tx,
          async (resourceTx) => {
            // [安全] 条件更新：仅当 isClaimed=false 时才标记，防止并发双领
            const [updated] = await resourceTx
              .update(mails)
              .set({ isClaimed: true, isRead: true })
              .where(and(eq(mails.id, mailId), eq(mails.isClaimed, false)))
              .returning({ id: mails.id });

            if (!updated) {
              throw new Error('邮件已被领取（并发冲突）');
            }
          },
        );

        if (!result.success) {
          throw new Error(result.errors?.[0] || '领取失败');
        }

        const [cultivatorState] = await tx
          .select({
            spiritStones: cultivators.spirit_stones,
            reputation: cultivators.reputation,
            cultivationProgress: cultivators.cultivation_progress,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
          })
          .from(cultivators)
          .where(eq(cultivators.id, cultivator.id))
          .limit(1);
        const unreadMailCount = await countUnreadMail(cultivator.id, tx);

        return {
          result: {
            claimedMailId: mailId,
            unreadMailCount,
          },
          changes: buildMailStateChanges({
            eventType: 'mail.claimed',
            unreadMailCount,
            mailIds: [mailId],
            gains,
            spiritStones: cultivatorState?.spiritStones,
            reputation: cultivatorState?.reputation,
            cultivationProgress: cultivatorState?.cultivationProgress,
            realm: cultivatorState?.realm as RealmType | undefined,
            realmStage: cultivatorState?.realmStage as RealmStage | undefined,
          }),
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } finally {
    await redis.del(claimLockKey);
  }
});

mailRouter.post('/claim-all', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  // [安全] 分布式锁防止同一用户并发批量领取
  const claimAllLockKey = `mail:claim-all:lock:${cultivator.id}`;
  const acquiredLock = await redis.set(claimAllLockKey, 'locked', 'EX', 15, 'NX');
  if (!acquiredLock) {
    return c.json({ error: '领取正在处理中，请稍后' }, 429);
  }

  try {
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

    const claimedMailIds = claimableMails.map((mail) => mail.id);
    const gains = claimableMails.flatMap((mail) =>
      attachmentsToResourceOperations((mail.attachments as MailAttachment[]) || []),
    );

    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'mail_claim_all',
      run: async (tx) => {
        const result = await resourceEngine.gainInTransaction(
          user.id,
          cultivator.id,
          gains,
          tx,
          async (resourceTx) => {
            // [安全] 条件更新：仅当 isClaimed=false 时才标记，防止并发双领
            const updatedRows = await resourceTx
              .update(mails)
              .set({ isClaimed: true, isRead: true })
              .where(
                and(inArray(mails.id, claimedMailIds), eq(mails.isClaimed, false)),
              )
              .returning({ id: mails.id });

            if (updatedRows.length !== claimedMailIds.length) {
              throw new Error('部分邮件已被领取（并发冲突）');
            }
          },
        );

        if (!result.success) {
          throw new Error(result.errors?.[0] || '一键领取失败');
        }

        const [cultivatorState] = await tx
          .select({
            spiritStones: cultivators.spirit_stones,
            reputation: cultivators.reputation,
            cultivationProgress: cultivators.cultivation_progress,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
          })
          .from(cultivators)
          .where(eq(cultivators.id, cultivator.id))
          .limit(1);
        const unreadMailCount = await countUnreadMail(cultivator.id, tx);

        return {
          result: {
            claimedCount: claimedMailIds.length,
            claimedMailIds,
            unreadMailCount,
          },
          changes: buildMailStateChanges({
            eventType: 'mail.claimed_all',
            unreadMailCount,
            mailIds: claimedMailIds,
            gains,
            spiritStones: cultivatorState?.spiritStones,
            reputation: cultivatorState?.reputation,
            cultivationProgress: cultivatorState?.cultivationProgress,
            realm: cultivatorState?.realm as RealmType | undefined,
            realmStage: cultivatorState?.realmStage as RealmStage | undefined,
          }),
        };
      },
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } finally {
    await redis.del(claimAllLockKey);
  }
});

mailRouter.post('/read', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { mailId } = ReadMailSchema.parse(await c.req.json());
  const mail = await getExecutor().query.mails.findFirst({
    where: and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivator.id)),
  });
  if (!mail) {
    return c.json({ error: 'Mail not found' }, 404);
  }

  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'mail_read',
    run: async (tx) => {
      await tx
        .update(mails)
        .set({ isRead: true })
        .where(and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivator.id)));
      const unreadMailCount = await countUnreadMail(cultivator.id, tx);

      return {
        result: {
          mailId,
          unreadMailCount,
        },
        changes: [
          {
            domain: 'mail' as const,
            eventType: 'mail.read',
            patch: { unreadMailCount, mailIds: [mailId] },
            invalidates: ['mail' as const],
          },
        ],
      };
    },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

mailRouter.post('/read-all', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'mail_read_all',
    run: async (tx) => {
      const updatedRows = await tx
        .update(mails)
        .set({ isRead: true })
        .where(
          and(eq(mails.cultivatorId, cultivator.id), eq(mails.isRead, false)),
        )
        .returning({ id: mails.id });
      const unreadMailCount = await countUnreadMail(cultivator.id, tx);

      return {
        result: {
          updatedCount: updatedRows.length,
          unreadMailCount,
        },
        changes: [
          {
            domain: 'mail' as const,
            eventType: 'mail.read_all',
            patch: {
              unreadMailCount,
              mailIds: updatedRows.map((row) => row.id),
            },
            invalidates: ['mail' as const],
          },
        ],
      };
    },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

mailRouter.get('/unread-count', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  return c.json({ count: await countUnreadMail(ref.cultivatorId) });
});

router.route('/inventory', inventoryRouter);
router.route('/mail', mailRouter);

export default router;
