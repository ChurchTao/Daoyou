import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  assertAlchemyMaterialVersions,
  readAlchemyMaterials,
} from '@server/lib/services/alchemy/AlchemyInventory';
import {
  analyzeFormulaMaterials,
  confirmDiscoveryCandidate,
  deleteCultivatorFormula,
  listCultivatorFormulasPage,
} from '@server/lib/services/AlchemyFormulaService';
import { AlchemyServiceError } from '@server/lib/services/AlchemyServiceError';
import {
  ALCHEMY_INPUT_CONSTRAINTS,
  ALCHEMY_MAX_DOSE,
} from '@shared/config/alchemyInput';
import { PILL_FAMILY_VALUES } from '@shared/types/consumable';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.get('/materials', requireActiveCultivatorRef(), async (c) =>
  c.json({
    success: true,
    data: await readAlchemyMaterials(
      c.get('activeCultivatorRef')!.cultivatorId,
    ),
  }),
);
const { minQuantityPerMaterial } = ALCHEMY_INPUT_CONSTRAINTS;

const DiscoveryConfirmSchema = z.object({
  token: z.string().uuid(),
  accept: z.boolean(),
});
const FormulaIdParamSchema = z.object({
  formulaId: z.string().uuid(),
});
const FormulaAnalyzeSchema = z.object({
  materialIds: z.array(z.string()).min(1).max(6),
  materialVersions: z.record(z.string(), z.string().max(10000)),
  materialQuantities: z
    .record(
      z.string(),
      z.number().int().min(minQuantityPerMaterial).max(ALCHEMY_MAX_DOSE),
    )
    .optional(),
});
const FormulaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5).default(5),
  search: z.string().trim().max(40).optional(),
  family: z.enum(PILL_FAMILY_VALUES).optional(),
});

router.get('/formulas', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const query = FormulaListQuerySchema.parse({
      page: c.req.query('page'),
      pageSize: c.req.query('pageSize'),
      search: c.req.query('search') || undefined,
      family: c.req.query('family') || undefined,
    });
    const result = await listCultivatorFormulasPage(
      cultivator.cultivatorId,
      query,
    );
    return c.json({
      success: true,
      data: {
        formulas: result.formulas,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: error.issues[0]?.message || '请求参数格式错误' },
        400,
      );
    }
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json({ error: '丹方列表读取失败，请稍后再试。' }, 500);
  }
});

router.delete(
  '/formulas/:formulaId',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    try {
      const { formulaId } = FormulaIdParamSchema.parse(c.req.param());
      await deleteCultivatorFormula(cultivator.cultivatorId, formulaId);

      return c.json({
        success: true,
        message: '丹方已删除',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: error.issues[0]?.message || '请求参数格式错误' },
          400,
        );
      }
      if (error instanceof AlchemyServiceError) {
        return jsonWithStatus(
          c,
          { error: error.message, ...(error.details ?? {}) },
          error.status,
        );
      }
      return c.json({ error: '丹方删除失败，请稍后再试。' }, 500);
    }
  },
);

router.post(
  '/formulas/:formulaId/analyze',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    try {
      const { formulaId } = FormulaIdParamSchema.parse(c.req.param());
      const { materialIds, materialQuantities, materialVersions } =
        FormulaAnalyzeSchema.parse(await c.req.json());
      await assertAlchemyMaterialVersions(
        cultivator.cultivatorId,
        materialIds,
        materialVersions,
      );
      const result = await analyzeFormulaMaterials(
        cultivator.cultivatorId,
        formulaId,
        materialIds,
        materialQuantities,
      );

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: error.issues[0]?.message || '请求参数格式错误' },
          400,
        );
      }
      if (error instanceof AlchemyServiceError) {
        return jsonWithStatus(
          c,
          { error: error.message, ...(error.details ?? {}) },
          error.status,
        );
      }
      return c.json({ error: '推演药路失败，请稍后再试。' }, 500);
    }
  },
);

router.post(
  '/formulas/discovery/confirm',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) {
      return c.json({ error: '当前没有活跃角色' }, 404);
    }

    try {
      const { token, accept } = DiscoveryConfirmSchema.parse(
        await c.req.json(),
      );
      const result = await confirmDiscoveryCandidate(
        cultivator.cultivatorId,
        token,
        accept,
      );

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { error: error.issues[0]?.message || '请求参数格式错误' },
          400,
        );
      }
      if (error instanceof AlchemyServiceError) {
        return jsonWithStatus(
          c,
          { error: error.message, ...(error.details ?? {}) },
          error.status,
        );
      }
      return c.json({ error: '丹方确认失败，请稍后再试。' }, 500);
    }
  },
);

export default router;
