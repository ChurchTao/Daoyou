import type { Ability } from '../abilities/Ability';
import type { Unit } from '../units/Unit';
import type {
  AbilityEffectLayerConfig,
  AbilityEffectPlanConfig,
  EffectConfig,
} from './configs';
import { checkConditions } from './conditionEvaluator';

export interface AbilityEffectPlanSource {
  name: string;
  description?: string;
  effects?: EffectConfig[];
  completionEffects?: EffectConfig[];
  effectLayers?: AbilityEffectLayerConfig[];
  effectPlans?: AbilityEffectPlanConfig[];
}

export interface AbilityEffectPlanContext {
  caster: Unit;
  target: Unit;
  ability: Ability;
}

export interface ResolvedAbilityEffectPlan {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly effects: ReadonlyArray<EffectConfig>;
  readonly completionEffects: ReadonlyArray<EffectConfig>;
  readonly consumeModeKey?: string;
}

/** 在施法准备阶段解析一次；调用方负责持有返回快照直至本次结算结束。 */
export function resolveAbilityEffectPlan(
  source: AbilityEffectPlanSource,
  context: AbilityEffectPlanContext,
): ResolvedAbilityEffectPlan {
  const plan = [...(source.effectPlans ?? [])]
    .sort((left, right) => right.priority - left.priority)
    .find((candidate) => checkConditions(context, candidate.conditions));
  const layersById = new Map(
    (source.effectLayers ?? []).map((layer) => [layer.id, layer] as const),
  );
  const selectedLayers = plan?.layerIds.map((id) => layersById.get(id)!) ?? [];

  return Object.freeze({
    id: plan?.id,
    name: plan?.name ?? source.name,
    description: plan?.description ?? source.description,
    effects: Object.freeze([
      ...(source.effects ?? []),
      ...selectedLayers.flatMap((layer) => layer.effects ?? []),
    ]),
    completionEffects: Object.freeze([
      ...(source.completionEffects ?? []),
      ...selectedLayers.flatMap((layer) => layer.completionEffects ?? []),
    ]),
    consumeModeKey: plan?.consumeModeKey,
  });
}

export function validateAbilityEffectPlans(source: {
  slug: string;
  effectLayers?: AbilityEffectLayerConfig[];
  effectPlans?: AbilityEffectPlanConfig[];
}): void {
  const layers = source.effectLayers ?? [];
  const plans = source.effectPlans ?? [];
  assertUniqueIds(source.slug, 'layer', layers.map((layer) => layer.id));
  assertUniqueIds(source.slug, 'plan', plans.map((plan) => plan.id));
  const layerIds = new Set(layers.map((layer) => layer.id));
  const allowedPlanKeys = new Set([
    'id',
    'name',
    'description',
    'priority',
    'conditions',
    'layerIds',
    'consumeModeKey',
  ]);
  for (const plan of plans) {
    const unsupportedKeys = Object.keys(plan).filter((key) => !allowedPlanKeys.has(key));
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `[AbilityFactory] ability ${source.slug} plan ${plan.id} cannot define ${unsupportedKeys.join(', ')}`,
      );
    }
    assertUniqueIds(source.slug, `plan ${plan.id} layer reference`, plan.layerIds);
    for (const layerId of plan.layerIds) {
      if (!layerIds.has(layerId)) {
        throw new Error(
          `[AbilityFactory] ability ${source.slug} plan ${plan.id} references unknown layer ${layerId}`,
        );
      }
    }
    if (plan.consumeModeKey !== undefined && plan.consumeModeKey.trim() === '') {
      throw new Error(
        `[AbilityFactory] ability ${source.slug} plan ${plan.id} has an empty consumeModeKey`,
      );
    }
  }
}

function assertUniqueIds(slug: string, kind: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id.trim()) {
      throw new Error(`[AbilityFactory] ability ${slug} has an empty ${kind} id`);
    }
    if (seen.has(id)) {
      throw new Error(`[AbilityFactory] ability ${slug} has duplicate ${kind} id ${id}`);
    }
    seen.add(id);
  }
}
