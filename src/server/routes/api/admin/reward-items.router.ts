import {
  getValidatedJson,
  requireAdmin,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getQuotaCategoryForFamily } from '@server/lib/services/AlchemyRecipeRules';
import { TALISMAN_SCENARIO_OPTIONS } from '@shared/config/talismanScenarios';
import { AdminItemGenerationSchema } from '@shared/contracts/adminItemGeneration';
import { RewardItemSchema } from '@shared/contracts/adminRewards';
import { generateForgedEquipment } from '@shared/engine/combat-v6/equipment/forging';
import { buildSpiritFruitSpec } from '@shared/engine/spirit-field/spiritFruit';
import {
  normalizeAlchemyEffectRoute,
  resolveAlchemyEffects,
} from '@shared/lib/alchemyEffectResolver';
import { getAlchemyPropertyFamily } from '@shared/lib/alchemyProperties';
import type { ConsumableSpec } from '@shared/types/consumable';
import { Hono } from 'hono';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.post(
  '/generate',
  requireAdmin(),
  validateJson(AdminItemGenerationSchema),
  async (c) => {
    const input =
      getValidatedJson<z.infer<typeof AdminItemGenerationSchema>>(c);
    if (input.kind === 'equipment') {
      const result = generateForgedEquipment({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        seed: randomInt(0, 0x100000000),
        boosts: { ore: 0, essence: 0, attributes: 0 },
      });
      if (!result.ok)
        return c.json(
          { error: result.diagnostics[0]?.message ?? '生成道装失败' },
          400,
        );
      return c.json({
        item: RewardItemSchema.parse({
          definitionId: 'equipment.v6',
          quantity: 1,
          instanceData: result.instance,
        }),
      });
    }
    let spec: ConsumableSpec;
    let name: string;
    if (input.kind === 'talisman') {
      spec = {
        kind: 'talisman',
        scenario: input.scenario,
        sessionMode: 'consume_on_action',
      };
      name = TALISMAN_SCENARIO_OPTIONS.find(
        (o) => o.value === input.scenario,
      )!.label.split('·')[0];
    } else if (input.kind === 'spirit_fruit') {
      spec = buildSpiritFruitSpec(input);
      name = input.name;
    } else {
      const family = getAlchemyPropertyFamily(input.effects[0]);
      const route = normalizeAlchemyEffectRoute({
        effects: input.effects.map((key, index) => ({
          key,
          weight: 3 - index,
        })),
      });
      if (route.effects.length !== input.effects.length)
        return c.json(
          { error: '药效不能重复，灵兽修为不能与人物药效混用' },
          400,
        );
      spec = {
        kind: 'pill',
        family,
        operations: resolveAlchemyEffects({
          route,
          quality: input.quality,
          appearance: input.appearance,
        }).operations,
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: getQuotaCategoryForFamily(family),
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: [],
          stability: 100,
          toxicityRating: 0,
          tags: [],
          appearance: input.appearance,
          version: 4,
          propertyVector: route.effects,
        },
      };
      name = input.name;
    }
    return c.json({
      item: RewardItemSchema.parse({
        definitionId: 'consumable.v1',
        quantity: 1,
        instanceData: {
          name,
          type: { pill: '丹药', talisman: '符箓', spirit_fruit: '灵果' }[
            input.kind
          ],
          quality: input.kind === 'talisman' ? '凡品' : input.quality,
          description: '',
          prompt: '',
          score: 0,
          spec,
        },
      }),
    });
  },
);
export default router;
