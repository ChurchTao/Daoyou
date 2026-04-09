import { Quality } from '@/types/constants';
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import {
  AffixDefinition,
  AffixListenerSpec,
  RolledAffix,
} from '../affixes/types';
import type { EffectConfig, ListenerConfig } from '../contracts/battle';
import type { CreationOutcomeKind, CreationProductType } from '../types';
/*
 * composers/shared.ts: Composer 公共工具。
 * 包含根据材料品质聚合默认质量、构建分组 listener，以及通用的 slug 生成器委托等辅助函数。
 */
import { buildMaterialQualityProfile } from '../analysis/MaterialBalanceProfile';
import { CreationSession } from '../CreationSession';
import { CompositionFacts } from '../rules/contracts/CompositionFacts';

export interface BuildGroupedListenersInput {
  registry: AffixRegistry;
  translator: AffixEffectTranslator;
  rolledAffixes: RolledAffix[];
  quality: Quality;
  defaultListenerSpec: AffixListenerSpec;
}

export function buildGroupedListeners({
  registry,
  translator,
  rolledAffixes,
  quality,
  defaultListenerSpec,
}: BuildGroupedListenersInput): ListenerConfig[] {
  const listenerMap = new Map<string, ListenerConfig>();

  for (const rolled of rolledAffixes) {
    const definition = registry.queryById(rolled.id);
    if (!definition) {
      continue;
    }

    const effect = translator.translate(rolled, quality);
    const spec = definition.listenerSpec ?? defaultListenerSpec;
...
    // Key design: (eventType, scope, priority) is the merge unit for listeners.
    // Affixes sharing the same triple are combined into a single ListenerConfig with
    // multiple effects. Affixes with different priorities produce independent listeners,
    // allowing different combat ordering. This is intentional — priority affects execution
    // order, so different-priority affixes must not be silently merged.
    const key = `${spec.eventType}||${spec.scope}||${spec.priority}`;

    const guard = buildCreationListenerGuard(spec.eventType, effect, spec.guard);

    if (!listenerMap.has(key)) {
      listenerMap.set(key, {
        eventType: spec.eventType,
        scope: spec.scope,
        priority: spec.priority,
        ...(spec.mapping ? { mapping: spec.mapping } : {}),
        ...(guard ? { guard } : {}),
        effects: [],
      });
    } else if (guard) {
      const existing = listenerMap.get(key)!;
      existing.guard = {
        ...existing.guard,
        ...guard,
      };
    }

    listenerMap.get(key)!.effects.push(effect);
  }

  return Array.from(listenerMap.values());
}

export function buildCreationListenerGuard(
  eventType: string,
  effect: EffectConfig,
  guard?: ListenerConfig['guard'],
): ListenerConfig['guard'] | undefined {
  if (eventType !== 'DamageTakenEvent' || effect.type !== 'damage') {
    return guard;
  }

  return {
    ...guard,
    skipReflectSource: true,
  };
}

/**
 * Builds a CompositionFacts object from the current session state.
 * Shared by all three Composer implementations to eliminate duplication.
 *
 * Pass an optional `registry` to populate `coreEffectType` from the core affix's effectTemplate.
 */
export function buildCompositionFacts(
  session: CreationSession,
  productType: CreationProductType,
  outcomeKind: CreationOutcomeKind,
  registry?: AffixRegistry,
): CompositionFacts {
  const { intent, energyBudget, rolledAffixes, input, materialFingerprints } = session.state;
  if (!intent) throw new Error('Cannot compose blueprint before resolving intent');
  if (!energyBudget) throw new Error('Cannot compose blueprint before energy budgeting');

  const materialQualityProfile = buildMaterialQualityProfile(materialFingerprints);

  let coreEffectType: string | undefined;
  if (registry) {
    const coreAffix = rolledAffixes.find((a) => a.category === 'core');
    if (coreAffix) {
      const coreDef = registry.queryById(coreAffix.id);
      coreEffectType = coreDef?.effectTemplate.type;
    }
  }

  return {
    productType,
    outcomeKind,
    intent,
    recipeMatch: session.state.recipeMatch!,
    energySummary: {
      effectiveTotal: energyBudget.effectiveTotal,
      reserved: energyBudget.reserved,
      startingAffixEnergy:
        energyBudget.initialRemaining ??
        Math.max(0, energyBudget.effectiveTotal - energyBudget.reserved),
      spentAffixEnergy: energyBudget.spent,
      remainingAffixEnergy: energyBudget.remaining,
    },
    affixes: rolledAffixes,
    sessionTags: session.state.tags,
    materialFingerprints,
    materialQualityProfile,
    materialNames: input.materials.map((m) => m.name),
    ...(coreEffectType !== undefined ? { coreEffectType } : {}),
  };
}