import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@shared/config/alchemyEffectConfig';
import { buildBreakthroughFocusOperation } from '@shared/lib/pillEffectScaling';
import type { ConditionOperation, PillFamily, SpiritFruitSpec } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';

const lower = (value: number) => Math.max(1, Math.floor(value * 0.8));

export function buildSpiritFruitOperations(family: PillFamily, quality: Quality): ConditionOperation[] {
  const base = ALCHEMY_EFFECT_BASE_BY_QUALITY[quality];
  switch (family) {
    case 'healing': return [{ type: 'restore_resource', resource: 'hp', mode: 'percent', value: Number((base.restorePercent * 0.8).toFixed(4)) }];
    case 'mana': return [{ type: 'restore_resource', resource: 'mp', mode: 'percent', value: Number((base.restorePercent * 0.8).toFixed(4)) }];
    case 'detox': return [{ type: 'change_gauge', gauge: 'pillToxicity', delta: -lower(base.detox) }];
    case 'insight': return [{ type: 'gain_progress', target: 'comprehension_insight', value: lower(base.insight) }];
    case 'longevity': return [{ type: 'increase_lifespan', value: lower(base.lifespan) }];
    case 'marrow_wash': return [{ type: 'advance_track', track: 'marrow_wash', value: lower(base.bodyTrack) }];
    case 'tempering': return [{ type: 'advance_track', track: 'body.qi_blood', value: lower(base.bodyTrack) }];
    case 'breakthrough': return [buildBreakthroughFocusOperation(quality, 0.8)];
    case 'cultivation': return [{ type: 'gain_progress', target: 'cultivation_exp', value: lower(base.insight * 8) }];
    case 'hybrid': return [
      { type: 'restore_resource', resource: 'hp', mode: 'percent', value: Number((base.restorePercent * 0.4).toFixed(4)) },
      { type: 'restore_resource', resource: 'mp', mode: 'percent', value: Number((base.restorePercent * 0.4).toFixed(4)) },
    ];
  }
}

export function buildSpiritFruitSpec(input: { family: PillFamily; quality: Quality }): SpiritFruitSpec {
  return {
    kind: 'spirit_fruit',
    family: input.family,
    operations: buildSpiritFruitOperations(input.family, input.quality),
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    source: { kind: 'spirit_field', version: 1 },
  };
}
