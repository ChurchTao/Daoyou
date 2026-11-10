import type { Quality } from '@daoyou/constants/qualities';
import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@daoyou/game-content/alchemy';
import { BEAST_CULTIVATION_BASE_BY_QUALITY } from '@daoyou/game-content/beasts';
import type {
  ConditionOperation,
  PillFamily,
  SpiritFruitSpec,
} from '@daoyou/game-domain/consumables';
import { PILL_FAMILY_VALUES } from '@daoyou/game-domain/consumables';
import {
  SpiritGardenFruitEffectsSchema,
  type SpiritGardenFruitEffect,
} from '@daoyou/game-domain/spirit-field';
import { buildBreakthroughFocusOperation } from '../alchemy/pillEffectScaling.js';
import { buildCultivationBoostOperation } from '../consumables/cultivation-boost.js';

const lower = (value: number) => Math.max(1, Math.floor(value * 0.8));

export function buildSpiritFruitOperations(
  family: PillFamily,
  quality: Quality,
): ConditionOperation[] {
  const base = ALCHEMY_EFFECT_BASE_BY_QUALITY[quality];
  switch (family) {
    case 'healing':
      return [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'percent',
          value: Number((base.restorePercent * 0.8).toFixed(4)),
        },
      ];
    case 'mana':
      return [
        {
          type: 'restore_resource',
          resource: 'mp',
          mode: 'percent',
          value: Number((base.restorePercent * 0.8).toFixed(4)),
        },
      ];
    case 'detox':
      return [
        {
          type: 'change_gauge',
          gauge: 'pillToxicity',
          delta: -lower(base.detox),
        },
      ];
    case 'insight':
      return [
        {
          type: 'gain_progress',
          target: 'comprehension_insight',
          value: lower(base.insight),
        },
      ];
    case 'longevity':
      return [{ type: 'increase_lifespan', value: lower(base.lifespan) }];
    case 'marrow_wash':
      return [
        {
          type: 'advance_track',
          track: 'marrow_wash',
          value: lower(base.bodyTrack),
        },
      ];
    case 'tempering':
      return [
        {
          type: 'advance_track',
          track: 'body.qi_blood',
          value: lower(base.bodyTrack),
        },
      ];
    case 'breakthrough':
      return [buildBreakthroughFocusOperation(quality, 0.8)];
    case 'beast_cultivation':
      return [
        {
          type: 'gain_beast_cultivation',
          value: lower(BEAST_CULTIVATION_BASE_BY_QUALITY[quality]),
        },
      ];
    case 'cultivation':
      return [buildCultivationBoostOperation(quality, 0.8)];
    case 'hybrid':
      return [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'percent',
          value: Number((base.restorePercent * 0.4).toFixed(4)),
        },
        {
          type: 'restore_resource',
          resource: 'mp',
          mode: 'percent',
          value: Number((base.restorePercent * 0.4).toFixed(4)),
        },
      ];
  }
}

/** Split the existing single-fruit value; composition never adds full-strength slots. */
function weightedOperations(
  effect: SpiritGardenFruitEffect,
  quality: Quality,
): ConditionOperation[] {
  const operations = buildSpiritFruitOperations(effect.family, quality);
  if (effect.share === 1) return operations;
  const fraction = (value: number) =>
    Math.floor(value * effect.share * 10_000 + 1e-8) / 10_000;
  const integer = (value: number) => Math.floor(value * effect.share + 1e-8);
  const weighted = operations.map((operation): ConditionOperation => {
    switch (operation.type) {
      case 'restore_resource':
        return { ...operation, value: fraction(operation.value) };
      case 'change_gauge':
        return { ...operation, delta: -integer(Math.abs(operation.delta)) };
      case 'gain_progress':
      case 'increase_lifespan':
      case 'advance_track':
      case 'gain_beast_cultivation':
        return { ...operation, value: integer(operation.value) };
      case 'add_status': {
        if (operation.status === 'cultivation_boost') {
          const boostPercent = fraction(
            Number(operation.payload?.boostPercent),
          );
          return {
            ...operation,
            payload: {
              boostPercent,
              retreatExpMultiplier: Number((1 + boostPercent).toFixed(4)),
            },
          };
        }
        if (operation.status === 'breakthrough_focus')
          return {
            ...operation,
            payload: {
              breakthroughChanceBonus: fraction(
                Number(operation.payload?.breakthroughChanceBonus),
              ),
            },
          };
        throw new Error('不支持的灵果复合状态');
      }
      default:
        throw new Error('不支持的灵果复合效果');
    }
  });
  if (
    weighted.some((operation) => {
      if (operation.type === 'add_status')
        return operation.status === 'cultivation_boost'
          ? Number(operation.payload?.boostPercent) <= 0
          : Number(operation.payload?.breakthroughChanceBonus) <= 0;
      return operation.type === 'change_gauge'
        ? operation.delta === 0
        : 'value' in operation && operation.value <= 0;
    })
  )
    throw new Error('当前品质不足以承载此灵果药效份额');
  return weighted;
}

export function buildSpiritFruitSpec(input: {
  family?: PillFamily;
  effects?: SpiritGardenFruitEffect[];
  quality: Quality;
}): SpiritFruitSpec {
  if (input.family && input.effects)
    throw new Error('灵果不能同时指定旧用途与复合效果');
  const effects = input.effects
    ? SpiritGardenFruitEffectsSchema.parse(input.effects)
    : undefined;
  if (!effects && (!input.family || !PILL_FAMILY_VALUES.includes(input.family)))
    throw new Error('灵果缺少有效用途');
  const family = effects
    ? effects.length === 1
      ? effects[0]!.family
      : 'hybrid'
    : input.family!;
  return {
    kind: 'spirit_fruit',
    family,
    operations: effects
      ? effects.flatMap((effect) => weightedOperations(effect, input.quality))
      : buildSpiritFruitOperations(family, input.quality),
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    source: { kind: 'spirit_field', version: 1 },
  };
}
