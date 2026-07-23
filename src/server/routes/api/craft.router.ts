import { requireActiveCultivator } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import {
  craftFromFormula,
  previewFormulaCraft,
} from '@server/lib/services/AlchemyFormulaService';
import {
  AlchemyServiceError,
  previewAlchemySelection,
  processAlchemyCraft,
} from '@server/lib/services/alchemyServiceV2';
import {
  abandonPending,
  confirmCreation,
  CreationServiceError,
  estimateCost,
  getPendingCreation,
  previewCreationSelection,
  processCreation,
} from '@server/lib/services/creationServiceV2';
import { getPlayerProfileCultivatorById } from '@server/lib/services/cultivatorService';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
  type StateChangeDescriptor,
} from '@server/lib/services/PlayerStateMutationService';
import {
  QiInsufficientError,
  QiService,
  QiServiceError,
} from '@server/lib/services/QiService';
import { TaskService } from '@server/lib/services/TaskService';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload';
import type { QiAction } from '@shared/config/qiSystem';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import {
  CREATION_CRAFT_TYPES,
  isCreationCraftType,
  type CreationCraftType,
} from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import type { CreationProductType } from '@shared/engine/creation-v2/types';
import {
  EQUIPMENT_SLOT_VALUES,
  QUALITY_ORDER,
  type ElementType,
  type Quality,
} from '@shared/types/constants';
import { ALCHEMY_MODE_VALUES } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import type { ItemShowcaseSnapshotMap } from '@shared/types/world-chat';
import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import { z } from 'zod';

const SUPPORTED_CRAFT_TYPES = [...CREATION_CRAFT_TYPES, 'alchemy'] as const;
const { minQuantityPerMaterial, maxQuantityPerMaterial } =
  CREATION_INPUT_CONSTRAINTS;
const WORLD_CHAT_BROADCAST_QUALITY_FLOOR: Quality = '天品';

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  craftType: z.enum(SUPPORTED_CRAFT_TYPES),
  alchemyMode: z.enum(ALCHEMY_MODE_VALUES).optional(),
  formulaId: z.string().uuid().optional(),
  analysisId: z.string().uuid().optional(),
  materialQuantities: z
    .record(
      z.string(),
      z.number().int().min(minQuantityPerMaterial).max(maxQuantityPerMaterial),
    )
    .optional(),
  userPrompt: z.string().trim().max(300).optional(),
  requestedSlot: z.enum(EQUIPMENT_SLOT_VALUES).optional(),
  requestedTargetPolicy: z
    .object({
      team: z.enum(['enemy', 'ally', 'self', 'any']),
      scope: z.enum(['single', 'aoe', 'random']),
      maxTargets: z.number().int().min(1).optional(),
    })
    .optional(),
});

const ConfirmSchema = z.object({
  craftType: z.enum(CREATION_CRAFT_TYPES),
  replaceId: z.uuid().nullable().optional(),
  abandon: z.boolean().optional(),
});

const router = new Hono<AppEnv>();
const pendingRouter = new Hono<AppEnv>();
const confirmRouter = new Hono<AppEnv>();

function parseMaterialQuantitiesQuery(
  value: string | undefined,
): Record<string, number> | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  return z
    .record(
      z.string(),
      z.number().int().min(minQuantityPerMaterial).max(maxQuantityPerMaterial),
    )
    .parse(parsed);
}

function getCraftQiAction(args: {
  craftType: (typeof SUPPORTED_CRAFT_TYPES)[number];
  alchemyMode?: string;
}): QiAction {
  if (args.craftType === 'alchemy') {
    return args.alchemyMode === 'formula'
      ? 'alchemy_formula'
      : 'alchemy_improvised';
  }

  const creationCraftType = args.craftType as CreationCraftType;
  if (creationCraftType === 'refine') return 'creation_artifact';
  if (creationCraftType === 'create_gongfa') return 'creation_gongfa';
  return 'creation_skill';
}

function qiErrorPayload(error: unknown) {
  if (error instanceof QiInsufficientError) {
    return {
      body: {
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      status: 409 as const,
    };
  }
  if (error instanceof QiServiceError) {
    return {
      body: { error: error.message },
      status: error.status,
    };
  }
  return null;
}

function buildAlchemyStateChanges(args: {
  qiAfter: number;
  taskSynced: boolean;
}): StateChangeDescriptor[] {
  const changes: StateChangeDescriptor[] = [
    {
      domain: 'currency',
      eventType: 'currency.changed',
      patch: {
        currency: {
          qi: args.qiAfter,
        },
      },
      invalidates: ['currency'],
    },
  ];

  if (args.taskSynced) {
    changes.push({
      domain: 'tasks',
      eventType: 'tasks.changed',
      invalidates: ['tasks'],
    });
  }

  return changes;
}

function buildCreationStateChanges(args: {
  craftType: CreationCraftType;
  qiAfter: number;
  needsReplace?: boolean;
}): StateChangeDescriptor[] {
  const changes: StateChangeDescriptor[] = [
    {
      domain: 'currency',
      eventType: 'currency.changed',
      patch: {
        currency: {
          qi: args.qiAfter,
        },
      },
      invalidates: ['currency'],
    },
  ];

  if (args.craftType === 'create_skill' || args.craftType === 'create_gongfa') {
    changes.push({
      domain: 'progress',
      eventType: 'progress.changed',
      invalidates: ['progress'],
    });
  }

  if (
    !args.needsReplace &&
    (args.craftType === 'create_skill' || args.craftType === 'create_gongfa')
  ) {
    changes.push({
      domain: 'loadout',
      eventType: 'loadout.changed',
      invalidates: ['loadout'],
    });
  }

  return changes;
}

type BroadcastableCreationResult = {
  id: string;
  productType: CreationProductType;
  name: string;
  description: string | null;
  element: string | null;
  quality: string | null;
  slot: string | null;
  score: number;
  productModel: Record<string, unknown>;
  needs_replace?: boolean;
};

function isBroadcastQuality(quality: string | null): quality is Quality {
  return (
    typeof quality === 'string' &&
    quality in QUALITY_ORDER &&
    QUALITY_ORDER[quality as Quality] >=
      QUALITY_ORDER[WORLD_CHAT_BROADCAST_QUALITY_FLOOR]
  );
}

function buildCreationShowcaseSnapshot(
  item: BroadcastableCreationResult,
): ItemShowcaseSnapshotMap[CreationProductType] {
  if (item.productType === 'artifact') {
    return {
      id: item.id,
      name: item.name,
      slot: item.slot as ItemShowcaseSnapshotMap['artifact']['slot'],
      element: item.element as ItemShowcaseSnapshotMap['artifact']['element'],
      quality: item.quality as ItemShowcaseSnapshotMap['artifact']['quality'],
      description: item.description ?? undefined,
      productModel: item.productModel,
    };
  }

  if (item.productType === 'skill') {
    return {
      id: item.id,
      name: item.name,
      productType: 'skill',
      element: item.element as ElementType | null,
      quality: item.quality as Quality | null,
      description: item.description,
      score: item.score,
      productModel: item.productModel,
    };
  }

  return {
    id: item.id,
    name: item.name,
    productType: 'gongfa',
    element: item.element as ElementType | null,
    quality: item.quality as Quality | null,
    description: item.description,
    score: item.score,
    productModel: item.productModel,
  };
}

async function broadcastCreationRumor(args: {
  userId: string;
  cultivatorName: string;
  item: BroadcastableCreationResult;
}) {
  const { item } = args;
  if (!item.id || item.needs_replace || !isBroadcastQuality(item.quality)) {
    return;
  }

  const text = `由${args.cultivatorName}炼成，品阶已入${item.quality}，灵韵自生，足令诸修侧目。`;

  try {
    await createMessage({
      senderUserId: args.userId,
      senderCultivatorId: null,
      senderName: '修仙界传闻',
      senderRealm: '炼气',
      senderRealmStage: '系统',
      channel: 'system',
      messageType: 'item_showcase',
      textContent: text,
      payload: {
        itemType: item.productType,
        itemId: item.id,
        snapshot: buildCreationShowcaseSnapshot(item),
        text,
      },
    });
  } catch (error) {
    console.error('造物传闻发送失败:', error);
  }
}

async function broadcastAlchemyRumor(args: {
  userId: string;
  cultivatorName: string;
  consumable?: Consumable;
}) {
  const { consumable } = args;
  if (!consumable?.id || !isBroadcastQuality(consumable.quality ?? null)) {
    return;
  }

  const text = `由${args.cultivatorName}炼成，丹品已入${consumable.quality}，药香化霞，足令诸修侧目。`;

  try {
    await createMessage({
      senderUserId: args.userId,
      senderCultivatorId: null,
      senderName: '修仙界传闻',
      senderRealm: '炼气',
      senderRealmStage: '系统',
      channel: 'system',
      messageType: 'item_showcase',
      textContent: text,
      payload: {
        itemType: 'consumable',
        itemId: consumable.id,
        snapshot: {
          id: consumable.id,
          name: consumable.name,
          type: consumable.type,
          quality: consumable.quality,
          quantity: consumable.quantity,
          description: consumable.description,
          spec: consumable.spec,
        },
        text,
      },
    });
  } catch (error) {
    console.error('造物传闻发送失败:', error);
  }
}

router.get('/', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const profileCultivator = await getPlayerProfileCultivatorById(
      user.id,
      cultivator.id,
    );
    const fateList = profileCultivator?.pre_heaven_fates ?? [];
    const materialIdsParam = c.req.query('materialIds');
    const materialQuantitiesParam = c.req.query('materialQuantities');
    const craftType = c.req.query('craftType');
    const alchemyMode = c.req.query('alchemyMode') ?? 'improvised';
    const formulaId = c.req.query('formulaId');
    const materialQuantities = parseMaterialQuantitiesQuery(
      materialQuantitiesParam,
    );

    if (!craftType) {
      return c.json({ error: '请指定造物类型' }, 400);
    }
    if (craftType !== 'alchemy' && !isCreationCraftType(craftType)) {
      return c.json({ error: '无效的造物类型' }, 400);
    }
    if (craftType === 'alchemy') {
      if (alchemyMode !== 'improvised' && alchemyMode !== 'formula') {
        return c.json({ error: '无效的炼丹模式' }, 400);
      }
      if (!materialIdsParam || materialIdsParam.length === 0) {
        return c.json({ error: '请选择材料以查询消耗' }, 400);
      }

      const materialIds = materialIdsParam.split(',');
      const preview =
        alchemyMode === 'formula'
          ? await (() => {
              if (!formulaId) {
                throw new AlchemyServiceError('请选择丹方后再校验炉材。');
              }
              return previewFormulaCraft(
                cultivator.id,
                formulaId,
                materialIds,
                cultivator.spirit_stones || 0,
                fateList,
                materialQuantities,
              );
            })()
          : await previewAlchemySelection(
              cultivator.id,
              cultivator.spirit_stones || 0,
              materialIds,
              fateList,
              materialQuantities,
            );

      return c.json({
        success: true,
        data:
          alchemyMode === 'formula'
            ? preview
            : {
                cost: preview.cost,
                canAfford: preview.canAfford,
                validation: preview.validation,
              },
      });
    }
    if (
      craftType !== 'create_skill' &&
      craftType !== 'create_gongfa' &&
      (!materialIdsParam || materialIdsParam.length === 0)
    ) {
      return c.json({ error: '请选择材料以查询消耗' }, 400);
    }

    let cost: { spiritStones?: number; comprehension?: number };
    let canAfford = true;
    let validation:
      | Awaited<ReturnType<typeof previewCreationSelection>>['validation']
      | null = null;

    if (materialIdsParam && materialIdsParam.length > 0) {
      const materialIds = materialIdsParam.split(',');
      const preview = await previewCreationSelection(
        cultivator.id,
        materialIds,
        craftType,
      );
      cost = await estimateCost(
        preview.materials as Array<{ rank: Quality }>,
        craftType,
        fateList,
        cultivator.id,
      );
      validation = preview.validation;
    } else {
      cost = await estimateCost(
        [{ rank: '凡品' }],
        craftType,
        fateList,
        cultivator.id,
      );
    }

    if (cost.spiritStones !== undefined) {
      canAfford = (cultivator.spirit_stones || 0) >= cost.spiritStones;
    } else if (cost.comprehension !== undefined) {
      const progress = cultivator.cultivation_progress as {
        comprehension_insight?: number;
      } | null;
      canAfford = (progress?.comprehension_insight || 0) >= cost.comprehension;
    }

    return c.json({
      success: true,
      data: {
        cost,
        canAfford,
        validation,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return c.json({ error: '材料数量参数格式错误' }, 400);
    }
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof CreationServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json({ error: '消耗预估失败，请稍后再试。' }, 500);
  }
});

router.post('/', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const parsed = CraftSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues[0]?.message || '请求参数格式错误' },
        400,
      );
    }

    const {
      materialIds,
      craftType,
      alchemyMode,
      formulaId,
      analysisId,
      materialQuantities,
      userPrompt,
      requestedSlot,
      requestedTargetPolicy,
    } = parsed.data;
    const normalizedUserPrompt = userPrompt
      ? normalizeFreeformLlmInput(userPrompt)
      : undefined;

    if (!materialIds || materialIds.length === 0) {
      return c.json({ error: '参数缺失，请选择材料' }, 400);
    }
    if (craftType === 'alchemy') {
      const resolvedAlchemyMode = alchemyMode ?? 'improvised';
      if (resolvedAlchemyMode === 'improvised' && !normalizedUserPrompt) {
        return c.json({ error: '请注入神念，描述丹药功效。' }, 400);
      }
      if (resolvedAlchemyMode === 'formula' && !formulaId) {
        return c.json({ error: '请先选定丹方。' }, 400);
      }
      if (resolvedAlchemyMode === 'formula' && !analysisId) {
        return c.json({ error: '请先推演药路。' }, 400);
      }

      const craftQiActionInstanceId = randomUUID();
      let afterCommit: (() => Promise<void>) | undefined;
      const committed = await commitPlayerStateMutation({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: `alchemy_${resolvedAlchemyMode}`,
        run: async (tx) => {
          const qiReservation = await QiService.reserveQi({
            cultivatorId: cultivator.id,
            action: getCraftQiAction({
              craftType,
              alchemyMode: resolvedAlchemyMode,
            }),
            actionInstanceId: craftQiActionInstanceId,
            metadata: {
              craftType,
              alchemyMode: resolvedAlchemyMode,
              materialCount: materialIds.length,
              formulaId,
            },
            tx,
          });

          const craftResult =
            resolvedAlchemyMode === 'formula'
              ? await craftFromFormula(
                  cultivator.id,
                  formulaId!,
                  materialIds,
                  materialQuantities,
                  analysisId,
                  { tx, deferSideEffects: true },
                )
              : await processAlchemyCraft(cultivator.id, materialIds, {
                  materialQuantities,
                  userPrompt: normalizedUserPrompt,
                  tx,
                });
          if ('afterCommit' in craftResult) {
            afterCommit = craftResult.afterCommit;
          }
          const result = { ...craftResult };
          delete (result as { afterCommit?: unknown }).afterCommit;

          await QiService.commitReservation({
            actionInstanceId: craftQiActionInstanceId,
            metadata: { committedAt: new Date().toISOString() },
            tx,
          });

          let taskSynced = false;
          try {
            await TaskService.recordTaskEvent(
              cultivator.id,
              'alchemy_crafted',
              {
                tx,
              },
            );
            taskSynced = true;
          } catch (syncError) {
            console.error('炼丹后同步任务失败:', syncError);
          }

          return {
            result,
            changes: buildAlchemyStateChanges({
              qiAfter: qiReservation.qiAfter,
              taskSynced,
            }),
          };
        },
      });
      if (afterCommit) {
        await afterCommit();
      }
      await broadcastAlchemyRumor({
        userId: user.id,
        cultivatorName: cultivator.name,
        consumable: committed.result.consumable,
      });

      return c.json(toPlayerStateMutationResponse(committed));
    }

    const craftQiActionInstanceId = randomUUID();
    let afterCommit: (() => Promise<void>) | undefined;
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: `creation_${craftType}`,
      run: async (tx) => {
        const qiReservation = await QiService.reserveQi({
          cultivatorId: cultivator.id,
          action: getCraftQiAction({ craftType }),
          actionInstanceId: craftQiActionInstanceId,
          metadata: {
            craftType,
            materialCount: materialIds.length,
            requestedSlot,
          },
          tx,
        });

        const { afterCommit: creationAfterCommit, ...result } =
          await processCreation(cultivator.id, materialIds, craftType, {
            materialQuantities,
            userPrompt: normalizedUserPrompt,
            requestedSlot,
            requestedTargetPolicy,
            tx,
            deferSideEffects: true,
          });
        afterCommit = creationAfterCommit;

        await QiService.commitReservation({
          actionInstanceId: craftQiActionInstanceId,
          metadata: { committedAt: new Date().toISOString() },
          tx,
        });

        return {
          result,
          changes: buildCreationStateChanges({
            craftType,
            qiAfter: qiReservation.qiAfter,
            needsReplace: Boolean(result.needs_replace),
          }),
        };
      },
    });
    if (afterCommit) {
      await afterCommit();
    }
    await broadcastCreationRumor({
      userId: user.id,
      cultivatorName: cultivator.name,
      item: committed.result as BroadcastableCreationResult,
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const qiError = qiErrorPayload(error);
    if (qiError) {
      return jsonWithStatus(c, qiError.body, qiError.status);
    }
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof CreationServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json(
        { error: error.issues[0]?.message || '请求参数格式错误' },
        400,
      );
    }
    return c.json({ error: '造物失败，请稍后再试。' }, 500);
  }
});

pendingRouter.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const craftType = c.req.query('type');
  if (!craftType || !isCreationCraftType(craftType)) {
    return c.json({ error: '无效的造物类型' }, 400);
  }

  const pending = await getPendingCreation(cultivator.id, craftType);
  return c.json({
    success: true,
    hasPending: !!pending,
    item: pending || null,
  });
});

confirmRouter.post('/', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { craftType, replaceId, abandon } = ConfirmSchema.parse(
      await c.req.json(),
    );
    if (abandon) {
      await abandonPending(cultivator.id, craftType);
      return c.json({
        success: true,
        message: '已放弃新生成的感悟',
      });
    }

    let afterCommit: (() => Promise<void>) | undefined;
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'creation_confirm',
      run: async (tx) => {
        const { afterCommit: confirmAfterCommit, ...result } =
          await confirmCreation(cultivator.id, craftType, replaceId ?? null, {
            tx,
            deferSideEffects: true,
          });
        afterCommit = confirmAfterCommit;
        return {
          result: {
            message: '领悟成功，已纳入道基',
            item: result,
          },
          changes: [
            {
              domain: 'loadout',
              eventType: 'loadout.changed',
              invalidates: ['loadout'],
            },
          ],
        };
      },
    });
    if (afterCommit) {
      await afterCommit();
    }
    await broadcastCreationRumor({
      userId: user.id,
      cultivatorName: cultivator.name,
      item: committed.result.item as BroadcastableCreationResult,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: error.issues[0]?.message || '请求参数格式错误' },
        400,
      );
    }
    if (error instanceof CreationServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('确认替换失败:', error);
    return c.json({ error: '确认失败，请稍后重试' }, 500);
  }
});

router.route('/pending', pendingRouter);
router.route('/confirm', confirmRouter);

export default router;
