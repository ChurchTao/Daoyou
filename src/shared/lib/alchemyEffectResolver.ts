import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@shared/config/alchemyEffectConfig';
import { PILL_APPEARANCE_EFFECT_MULTIPLIER } from '@shared/config/alchemyEssenceConfig';
import type { Quality } from '@shared/types/constants';
import {
  ALCHEMY_PROPERTY_KEY_VALUES,
  type AlchemyEffectKey,
  type AlchemyEffectRoute,
  type ConditionOperation,
  type PillAppearanceGrade,
} from '@shared/types/consumable';
import { getAlchemyPropertyTrackPath } from './alchemyProperties';
import { buildCultivationBoostPayload } from './cultivationBoost';
import { getPillAppearanceToxicityMultiplier } from './pillAppearance';

export const ALCHEMY_EFFECT_SLOT_MULTIPLIERS = [1, 0.35, 0.2] as const;

const ALCHEMY_EFFECT_KEYS = new Set<string>(ALCHEMY_PROPERTY_KEY_VALUES);

export interface ResolvedAlchemyEffectBreakdown {
  key: AlchemyEffectKey;
  slot: 'primary' | 'secondary' | 'tertiary';
  baseValue: number;
  slotMultiplier: number;
  fitMultiplier: number;
  appearanceMultiplier: number;
  finalValue: number;
}

export interface ResolveAlchemyEffectsInput {
  route: AlchemyEffectRoute;
  quality: Quality;
  appearance: PillAppearanceGrade;
  fitMultiplier?: number;
}

export interface ResolvedAlchemyEffects {
  operations: ConditionOperation[];
  effectBreakdown: ResolvedAlchemyEffectBreakdown[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function slotName(index: number): ResolvedAlchemyEffectBreakdown['slot'] {
  return index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary';
}

export function normalizeAlchemyEffectRoute(
  route: AlchemyEffectRoute,
): AlchemyEffectRoute {
  const merged = new Map<AlchemyEffectKey, number>();
  for (const effect of route.effects ?? []) {
    if (
      !effect ||
      !ALCHEMY_EFFECT_KEYS.has(effect.key) ||
      !Number.isFinite(effect.weight) ||
      effect.weight <= 0
    ) {
      continue;
    }
    merged.set(effect.key, (merged.get(effect.key) ?? 0) + effect.weight);
  }
  const selected = [...merged.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
  const total = selected.reduce((sum, [, weight]) => sum + weight, 0);
  return {
    effects: selected.map(([key, weight]) => ({
      key,
      weight: round4(weight / total),
    })),
  };
}

export function validateAlchemyEffectRoute(
  route: AlchemyEffectRoute,
): AlchemyEffectRoute {
  if (!route || !Array.isArray(route.effects)) {
    throw new Error('丹药药性路线无效');
  }
  if (route.effects.length === 0 || route.effects.length > 3) {
    throw new Error('丹药药性路线必须包含一至三个效果');
  }
  const seen = new Set<string>();
  let previousWeight = Number.POSITIVE_INFINITY;
  let totalWeight = 0;
  for (const effect of route.effects) {
    if (!effect || !ALCHEMY_EFFECT_KEYS.has(effect.key)) {
      throw new Error(`丹药药性 key 无效：${String(effect?.key)}`);
    }
    if (
      !Number.isFinite(effect.weight) ||
      effect.weight <= 0 ||
      effect.weight > 1
    ) {
      throw new Error(`丹药药性权重无效：${effect.key}`);
    }
    if (seen.has(effect.key)) {
      throw new Error(`丹药药性路线包含重复效果：${effect.key}`);
    }
    if (effect.weight > previousWeight) {
      throw new Error('丹药药性路线未按权重降序排列');
    }
    seen.add(effect.key);
    previousWeight = effect.weight;
    totalWeight += effect.weight;
  }
  if (Math.abs(totalWeight - 1) > 0.001) {
    throw new Error('丹药药性路线权重未归一化');
  }
  return route;
}

function getBaseValue(key: AlchemyEffectKey, quality: Quality): number {
  const base = ALCHEMY_EFFECT_BASE_BY_QUALITY[quality];
  switch (key) {
    case 'restore_hp':
    case 'restore_mp':
      return base.restorePercent;
    case 'detox':
      return base.detox;
    case 'cultivation':
      return base.cultivationBoost;
    case 'insight':
      return base.insight;
    case 'extend_lifespan':
      return base.lifespan;
    case 'marrow_wash':
    case 'body_skin':
    case 'body_sinew_bone':
    case 'body_organs':
    case 'body_qi_blood':
    case 'body_primordial_spirit':
      return base.bodyTrack;
    case 'protect_meridians_support':
      return base.protectMeridians;
    case 'breakthrough_support':
      return base.breakthroughFocus;
    case 'clear_mind_support':
      return base.clearMindUses;
    case 'heal_wounds':
      return base.healingTier;
  }
}

function resolveFinalValue(key: AlchemyEffectKey, rawValue: number): number {
  switch (key) {
    case 'restore_hp':
    case 'restore_mp':
      return round4(clamp(rawValue, 0, 1));
    case 'cultivation':
    case 'protect_meridians_support':
    case 'breakthrough_support':
      return round4(rawValue);
    case 'heal_wounds':
      return clamp(Math.floor(rawValue), 1, 3);
    case 'clear_mind_support':
      return Math.max(1, Math.floor(rawValue));
    default:
      return Math.max(0, Math.floor(rawValue));
  }
}

function buildOperation(
  key: AlchemyEffectKey,
  finalValue: number,
): ConditionOperation {
  switch (key) {
    case 'restore_hp':
      return {
        type: 'restore_resource',
        resource: 'hp',
        mode: 'percent',
        value: finalValue,
      };
    case 'restore_mp':
      return {
        type: 'restore_resource',
        resource: 'mp',
        mode: 'percent',
        value: finalValue,
      };
    case 'detox':
      return {
        type: 'change_gauge',
        gauge: 'pillToxicity',
        delta: -finalValue,
      };
    case 'cultivation':
      return {
        type: 'add_status',
        status: 'cultivation_boost',
        usesRemaining: 1,
        payload: buildCultivationBoostPayload(finalValue),
      };
    case 'insight':
      return {
        type: 'gain_progress',
        target: 'comprehension_insight',
        value: finalValue,
      };
    case 'extend_lifespan':
      return { type: 'increase_lifespan', value: finalValue };
    case 'marrow_wash':
      return { type: 'advance_track', track: 'marrow_wash', value: finalValue };
    case 'heal_wounds':
      return {
        type: 'remove_status',
        status:
          finalValue >= 3
            ? 'near_death'
            : finalValue >= 2
              ? 'major_wound'
              : 'minor_wound',
      };
    case 'clear_mind_support':
      return {
        type: 'add_status',
        status: 'clear_mind',
        usesRemaining: finalValue,
        payload: { preventsInnerDemon: true },
      };
    case 'protect_meridians_support':
      return {
        type: 'add_status',
        status: 'protect_meridians',
        usesRemaining: 1,
        payload: { failureExpLossReductionPercent: finalValue },
      };
    case 'breakthrough_support':
      return {
        type: 'add_status',
        status: 'breakthrough_focus',
        usesRemaining: 1,
        payload: { breakthroughChanceBonus: finalValue },
      };
    default: {
      const track = getAlchemyPropertyTrackPath(key);
      if (!track) throw new Error(`无法解析丹药药性：${key}`);
      return { type: 'advance_track', track, value: finalValue };
    }
  }
}

function buildPositiveToxicity(
  quality: Quality,
  appearance: PillAppearanceGrade,
): number {
  if (appearance === 'perfect') return 1;
  return Math.max(
    1,
    Math.ceil(
      ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].positiveToxicity *
        getPillAppearanceToxicityMultiplier(appearance),
    ),
  );
}

export function resolveAlchemyEffects(
  input: ResolveAlchemyEffectsInput,
): ResolvedAlchemyEffects {
  const route = validateAlchemyEffectRoute(input.route);
  const fitMultiplier = clamp(input.fitMultiplier ?? 1, 0.85, 1.15);
  const appearanceMultiplier =
    PILL_APPEARANCE_EFFECT_MULTIPLIER[input.appearance];
  const operations: ConditionOperation[] = [];
  const effectBreakdown: ResolvedAlchemyEffectBreakdown[] = [];

  route.effects.forEach((effect, index) => {
    const slotMultiplier = ALCHEMY_EFFECT_SLOT_MULTIPLIERS[index] ?? 0.2;
    const baseValue = getBaseValue(effect.key, input.quality);
    const finalValue = resolveFinalValue(
      effect.key,
      baseValue * slotMultiplier * fitMultiplier * appearanceMultiplier,
    );
    effectBreakdown.push({
      key: effect.key,
      slot: slotName(index),
      baseValue,
      slotMultiplier,
      fitMultiplier,
      appearanceMultiplier,
      finalValue,
    });
    operations.push(buildOperation(effect.key, finalValue));
  });

  if (!route.effects.some((effect) => effect.key === 'detox')) {
    operations.push({
      type: 'change_gauge',
      gauge: 'pillToxicity',
      delta: buildPositiveToxicity(input.quality, input.appearance),
    });
  }

  return { operations, effectBreakdown };
}
