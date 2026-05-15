import {
  abandonPending,
  confirmCreation,
  CreationServiceError,
  estimateCost,
  getPendingCreation,
  previewCreationSelection,
  processCreation,
} from '@server/lib/services/creationServiceV2';
import {
  AlchemyServiceError,
  previewAlchemySelection,
  processAlchemyCraft,
} from '@server/lib/services/alchemyServiceV2';
import {
  craftFromFormula,
  previewFormulaCraft,
} from '@server/lib/services/AlchemyFormulaService';
import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import {
  CREATION_CRAFT_TYPES,
  isCreationCraftType,
} from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import { ALCHEMY_MODE_VALUES } from '@shared/types/consumable';
import { EQUIPMENT_SLOT_VALUES, type Quality } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const SUPPORTED_CRAFT_TYPES = [...CREATION_CRAFT_TYPES, 'alchemy'] as const;
const { minQuantityPerMaterial, maxQuantityPerMaterial } =
  CREATION_INPUT_CONSTRAINTS;

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  craftType: z.enum(SUPPORTED_CRAFT_TYPES),
  alchemyMode: z.enum(ALCHEMY_MODE_VALUES).optional(),
  formulaId: z.string().uuid().optional(),
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

router.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const materialIdsParam = c.req.query('materialIds');
    const craftType = c.req.query('craftType');
    const alchemyMode = c.req.query('alchemyMode') ?? 'improvised';
    const formulaId = c.req.query('formulaId');

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
      const preview = alchemyMode === 'formula'
        ? await (() => {
            if (!formulaId) {
              throw new AlchemyServiceError('请选择丹方后再校验炉材。');
            }
            return previewFormulaCraft(
              cultivator.id,
              formulaId,
              materialIds,
              cultivator.spirit_stones || 0,
            );
          })()
        : await previewAlchemySelection(
            cultivator.id,
            cultivator.spirit_stones || 0,
            materialIds,
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
    let validation: Awaited<
      ReturnType<typeof previewCreationSelection>
    >['validation'] | null = null;

    if (materialIdsParam && materialIdsParam.length > 0) {
      const materialIds = materialIdsParam.split(',');
      const preview = await previewCreationSelection(
        cultivator.id,
        materialIds,
        craftType,
      );
      cost = estimateCost(preview.materials as Array<{ rank: Quality }>, craftType);
      validation = preview.validation;
    } else {
      cost = estimateCost([{ rank: '凡品' }], craftType);
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
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
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
      materialQuantities,
      userPrompt,
      requestedSlot,
      requestedTargetPolicy,
    } = parsed.data;

    if (!materialIds || materialIds.length === 0) {
      return c.json({ error: '参数缺失，请选择材料' }, 400);
    }
    if (craftType === 'alchemy') {
      const resolvedAlchemyMode = alchemyMode ?? 'improvised';
      if (resolvedAlchemyMode === 'improvised' && !userPrompt?.trim()) {
        return c.json({ error: '请注入神念，描述丹药功效。' }, 400);
      }
      if (resolvedAlchemyMode === 'formula' && !formulaId) {
        return c.json({ error: '请先选定丹方。' }, 400);
      }

      const result = resolvedAlchemyMode === 'formula'
        ? await craftFromFormula(
            cultivator.id,
            formulaId!,
            materialIds,
            materialQuantities,
          )
        : await processAlchemyCraft(cultivator.id, materialIds, {
            materialQuantities,
            userPrompt,
          });

      return c.json({ success: true, data: result });
    }

    const result = await processCreation(cultivator.id, materialIds, craftType, {
      materialQuantities,
      userPrompt,
      requestedSlot,
      requestedTargetPolicy,
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof CreationServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
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
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { craftType, replaceId, abandon } = ConfirmSchema.parse(await c.req.json());
    if (abandon) {
      await abandonPending(cultivator.id, craftType);
      return c.json({
        success: true,
        message: '已放弃新生成的感悟',
      });
    }

    const result = await confirmCreation(cultivator.id, craftType, replaceId ?? null);
    return c.json({
      success: true,
      message: '领悟成功，已纳入道基',
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
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
