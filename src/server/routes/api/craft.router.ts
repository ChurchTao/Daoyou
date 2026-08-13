import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  previewFormulaCraft,
} from '@server/lib/services/AlchemyFormulaService';
import {
  AlchemyServiceError,
  previewAlchemySelection,
} from '@server/lib/services/alchemyServiceV2';
import {
  CreationServiceError,
  estimateCost,
  getPendingCreation,
  previewCreationSelection,
} from '@server/lib/services/creationServiceV2';
import {
  getPlayerPreHeavenFates,
} from '@server/lib/services/cultivator/CultivatorProfileRepository';
import {
  CraftCommandError,
  executeCraftCommand,
  executeCreationConfirmationCommand,
} from '@server/lib/services/CraftApplicationService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import {
  ALCHEMY_MAX_DOSE,
  CREATION_INPUT_CONSTRAINTS,
} from '@shared/engine/creation-v2/config/CreationBalance';
import {
  CREATION_CRAFT_TYPES,
  isCreationCraftType,
} from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import { SELF_CREATED_SKILL_CREATION_FROZEN_ERROR } from '@shared/config/selfCreatedSkillFreeze';
import {
  EQUIPMENT_SLOT_VALUES,
  type Quality,
} from '@shared/types/constants';
import { ALCHEMY_MODE_VALUES } from '@shared/types/consumable';
import { Hono } from 'hono';
import { z } from 'zod';
import { readCraftReadinessFacts } from '@server/lib/services/cultivator/CultivatorFactsReader';

const SUPPORTED_CRAFT_TYPES = [...CREATION_CRAFT_TYPES, 'alchemy'] as const;
const { minQuantityPerMaterial, maxQuantityPerMaterial } =
  CREATION_INPUT_CONSTRAINTS;

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  craftType: z.enum(SUPPORTED_CRAFT_TYPES),
  alchemyMode: z.enum(ALCHEMY_MODE_VALUES).optional(),
  formulaId: z.string().uuid().optional(),
  analysisId: z.string().uuid().optional(),
  materialQuantities: z
    .record(
      z.string(),
      z.number().int().min(minQuantityPerMaterial).max(ALCHEMY_MAX_DOSE),
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
}).superRefine((value, context) => {
  if (value.craftType !== 'alchemy' && value.materialQuantities) {
    for (const [id, quantity] of Object.entries(value.materialQuantities)) {
      if (quantity > maxQuantityPerMaterial) {
        context.addIssue({
          code: 'custom',
          path: ['materialQuantities', id],
          message: `普通造物单种材料最多投入 ${maxQuantityPerMaterial} 个`,
        });
      }
    }
  }
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
      z.number().int().min(minQuantityPerMaterial).max(ALCHEMY_MAX_DOSE),
    )
    .parse(parsed);
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

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const fateList = await getPlayerPreHeavenFates(
      user.id,
      cultivator.cultivatorId,
    );
    if (!fateList) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }
    const readiness = await readCraftReadinessFacts(
      cultivator.cultivatorId,
    );
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
                cultivator.cultivatorId,
                formulaId,
                materialIds,
                readiness.spiritStones,
                fateList,
                materialQuantities,
              );
            })()
          : await previewAlchemySelection(
              cultivator.cultivatorId,
              readiness.spiritStones,
              materialIds,
              fateList,
              materialQuantities,
            );

      return c.json({
        success: true,
        data: preview,
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
        cultivator.cultivatorId,
        materialIds,
        craftType,
      );
      cost = await estimateCost(
        preview.materials as Array<{ rank: Quality }>,
        craftType,
        fateList,
        cultivator.cultivatorId,
      );
      validation = preview.validation;
    } else {
      cost = await estimateCost(
        [{ rank: '凡品' }],
        craftType,
        fateList,
        cultivator.cultivatorId,
      );
    }

    if (cost.spiritStones !== undefined) {
      canAfford = readiness.spiritStones >= cost.spiritStones;
    } else if (cost.comprehension !== undefined) {
      const progress = readiness.cultivationProgress;
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

router.post('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
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
    if (parsed.data.craftType === 'create_skill') {
      return c.json(
        {
          error: SELF_CREATED_SKILL_CREATION_FROZEN_ERROR,
          code: 'SELF_CREATED_SKILL_CREATION_FROZEN',
        },
        409,
      );
    }

    const committed = await executeCraftCommand({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
      input: {
        ...parsed.data,
        materialIds: parsed.data.materialIds ?? [],
      },
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
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
    if (error instanceof CraftCommandError) {
      return c.json({ error: error.message }, error.status);
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

pendingRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const craftType = c.req.query('type');
  if (!craftType || !isCreationCraftType(craftType)) {
    return c.json({ error: '无效的造物类型' }, 400);
  }

  const pending = await getPendingCreation(cultivator.cultivatorId, craftType);
  return c.json({
    success: true,
    hasPending: !!pending,
    item: pending || null,
  });
});

confirmRouter.post('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { craftType, replaceId, abandon } = ConfirmSchema.parse(
      await c.req.json(),
    );
    if (craftType === 'create_skill' && !abandon) {
      return c.json(
        {
          error: SELF_CREATED_SKILL_CREATION_FROZEN_ERROR,
          code: 'SELF_CREATED_SKILL_CREATION_FROZEN',
        },
        409,
      );
    }
    const result = await executeCreationConfirmationCommand({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
      craftType,
      replaceId,
      abandon,
    });
    if (result.kind === 'abandoned') {
      return c.json({ success: true, message: result.message });
    }
    return c.json(toPlayerStateMutationResponse(result.committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
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
