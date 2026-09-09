import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { assertAlchemyMaterialVersions } from '@server/lib/services/alchemy/AlchemyInventory';
import { previewFormulaCraft } from '@server/lib/services/AlchemyFormulaService';
import {
  AlchemyServiceError,
  previewAlchemySelection,
} from '@server/lib/services/alchemyServiceV2';
import {
  CraftCommandError,
  executeCraftCommand,
} from '@server/lib/services/CraftApplicationService';
import { readCraftReadinessFacts } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { QiServiceError } from '@server/lib/services/QiService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { ALCHEMY_MAX_DOSE } from '@shared/config/alchemyInput';
import { Hono } from 'hono';
import { z } from 'zod';

const quantities = z.record(
  z.string(),
  z.number().int().min(1).max(ALCHEMY_MAX_DOSE),
);
const CraftSchema = z
  .object({
    craftType: z.literal('alchemy'),
    alchemyMode: z.enum(['improvised', 'formula']).default('improvised'),
    materialIds: z
      .array(z.string().min(1).max(160))
      .min(1)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length, '材料不能重复'),
    materialVersions: z.record(z.string(), z.string().max(10000)),
    materialQuantities: quantities.optional(),
    userPrompt: z.string().trim().max(300).optional(),
    formulaId: z.uuid().optional(),
    analysisId: z.uuid().optional(),
  })
  .strict();
const router = new Hono<AppEnv>();
const retired = new Set(['refine', 'create_skill', 'create_gongfa']);
const retiredMessage = '旧功法、神通及装备生产已停用，历史物品保留在洞府宝库';
router.use('*', requireActiveCultivatorRef());
router.onError((error, c) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return c.json({ success: false, error: '请求参数无效' }, 400);
  if (
    error instanceof AlchemyServiceError ||
    error instanceof CraftCommandError ||
    error instanceof QiServiceError
  )
    return jsonWithStatus(
      c,
      { success: false, error: error.message },
      error.status,
    );
  console.error('[alchemy] request failed', error);
  return c.json({ success: false, error: '炼丹请求失败，请重新核对材料' }, 500);
});
router.get('/', async (c) => {
  const craftType = c.req.query('craftType');
  if (craftType && retired.has(craftType))
    return c.json({ error: retiredMessage }, 410);
  const input = CraftSchema.parse({
    craftType,
    alchemyMode: c.req.query('alchemyMode'),
    materialIds: (c.req.query('materialIds') ?? '').split(','),
    materialQuantities: c.req.query('materialQuantities')
      ? JSON.parse(c.req.query('materialQuantities')!)
      : undefined,
    formulaId: c.req.query('formulaId'),
    materialVersions: c.req.query('materialVersions')
      ? JSON.parse(c.req.query('materialVersions')!)
      : {},
  });
  const owner = c.get('activeCultivatorRef')!.cultivatorId;
  await assertAlchemyMaterialVersions(
    owner,
    input.materialIds,
    input.materialVersions,
  );
  const [facts, fates] = await Promise.all([
    readCraftReadinessFacts(owner),
    getPlayerPreHeavenFates(c.get('user')!.id, owner),
  ]);
  if (input.alchemyMode === 'formula' && !input.formulaId)
    return c.json({ error: '请选择丹方' }, 400);
  const data =
    input.alchemyMode === 'formula'
      ? await previewFormulaCraft(
          owner,
          input.formulaId!,
          input.materialIds,
          facts.spiritStones,
          fates ?? [],
          input.materialQuantities,
        )
      : await previewAlchemySelection(
          owner,
          facts.spiritStones,
          input.materialIds,
          fates ?? [],
          input.materialQuantities,
        );
  return c.json({ success: true, data });
});
router.post('/', async (c) => {
  const body = await c.req.json();
  if (body && retired.has(body.craftType))
    return c.json({ error: retiredMessage }, 410);
  const input = CraftSchema.parse(body);
  await assertAlchemyMaterialVersions(
    c.get('activeCultivatorRef')!.cultivatorId,
    input.materialIds,
    input.materialVersions,
  );
  return c.json(
    toPlayerStateMutationResponse(
      await executeCraftCommand({
        userId: c.get('user')!.id,
        cultivatorId: c.get('activeCultivatorRef')!.cultivatorId,
        input,
      }),
    ),
  );
});
router.all('/pending', (c) => c.json({ error: retiredMessage }, 410));
router.all('/confirm', (c) => c.json({ error: retiredMessage }, 410));
export default router;
