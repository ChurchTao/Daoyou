import { HttpException, Injectable } from '@nestjs/common';
import { getQuotaCategoryForFamily } from '@server/alchemy/application/AlchemyRecipeRules.js';
import { TALISMAN_SCENARIO_OPTIONS } from '@daoyou/game-domain/consumables';
import { AdminItemGenerationSchema } from '@daoyou/contracts/admin/item-generation';
import { RewardItemSchema } from '@daoyou/game-rules/rewards/materials';
import { generateForgedEquipment } from '@daoyou/game-rules/equipment/forging';
import { buildSpiritFruitSpec } from '@daoyou/game-rules/spirit-field';
import {
  normalizeAlchemyEffectRoute,
  resolveAlchemyEffects,
  getAlchemyPropertyFamily,
} from '@daoyou/game-rules/alchemy';
import type { ConsumableSpec } from '@daoyou/game-domain/consumables';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
@Injectable()
export class AdminRewardItemsService {
  generate(input: z.infer<typeof AdminItemGenerationSchema>) {
    if (input.kind === 'equipment') {
      const result = generateForgedEquipment({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        seed: randomInt(0, 0x100000000),
        boosts: { ore: 0, essence: 0, attributes: 0 },
      });
      if (!result.ok)
        throw new HttpException(
          { error: result.diagnostics[0]?.message ?? '生成道装失败' },
          400,
        );
      return {
        item: RewardItemSchema.parse({
          definitionId: 'equipment.v6',
          quantity: 1,
          instanceData: result.instance,
        }),
      };
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
        throw new HttpException(
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
    return {
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
    };
  }
}
