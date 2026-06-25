import {
  analyzeFormulaMaterials,
  confirmDiscoveryCandidate,
  deleteCultivatorFormula,
  listCultivatorFormulasPage,
} from '@server/lib/services/AlchemyFormulaService';
import { AlchemyServiceError } from '@server/lib/services/AlchemyServiceError';
import { requireActiveCultivator } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { CREATION_INPUT_CONSTRAINTS } from '@shared/engine/creation-v2/config/CreationBalance';
import { PILL_FAMILY_VALUES } from '@shared/types/consumable';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const { minQuantityPerMaterial, maxQuantityPerMaterial } =
  CREATION_INPUT_CONSTRAINTS;

const DiscoveryConfirmSchema = z.object({
  token: z.string().uuid(),
  accept: z.boolean(),
});
const FormulaIdParamSchema = z.object({
  formulaId: z.string().uuid(),
});
const FormulaAnalyzeSchema = z.object({
  materialIds: z.array(z.string()).min(1),
  materialQuantities: z
    .record(
      z.string(),
      z
        .number()
        .int()
        .min(minQuantityPerMaterial)
        .max(maxQuantityPerMaterial),
    )
    .optional(),
});
const FormulaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(5).default(5),
  search: z.string().trim().max(40).optional(),
  family: z.enum(PILL_FAMILY_VALUES).optional(),
});

router.get('/formulas', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
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
    const result = await listCultivatorFormulasPage(cultivator.id, query);
    return c.json({
      success: true,
      data: {
        formulas: result.formulas,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
    }
    if (error instanceof AlchemyServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json({ error: '丹方列表读取失败，请稍后再试。' }, 500);
  }
});

router.delete('/formulas/:formulaId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { formulaId } = FormulaIdParamSchema.parse(c.req.param());
    await deleteCultivatorFormula(cultivator.id, formulaId);

    return c.json({
      success: true,
      message: '丹方已删除',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
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
});

router.post('/formulas/:formulaId/analyze', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { formulaId } = FormulaIdParamSchema.parse(c.req.param());
    const { materialIds, materialQuantities } = FormulaAnalyzeSchema.parse(
      await c.req.json(),
    );
    const result = await analyzeFormulaMaterials(
      cultivator.id,
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
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
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
});

router.post('/formulas/discovery/confirm', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const { token, accept } = DiscoveryConfirmSchema.parse(await c.req.json());
    const result = await confirmDiscoveryCandidate(cultivator.id, token, accept);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '请求参数格式错误' }, 400);
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
});

export default router;
