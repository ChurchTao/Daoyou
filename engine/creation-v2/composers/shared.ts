import { QUALITY_ORDER, QUALITY_VALUES, Quality } from '@/types/constants';
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import type { AffixListenerSpec } from '../affixes/types';
import type { ListenerConfig } from '../contracts/battle';
import type { CreationOutcomeKind, CreationProductType, MaterialFingerprint } from '../types';
/*
 * composers/shared.ts: Composer 公共工具。
 * 包含根据材料品质聚合默认质量、构建分组 listener，以及通用的 slug 生成器委托等辅助函数。
 */
import { CreationSession } from '../CreationSession';
import { CompositionFacts } from '../rules/contracts/CompositionFacts';

export function getDominantQuality(
  fingerprints: MaterialFingerprint[],
): Quality {
  const maxOrder = fingerprints.reduce(
    (max, fingerprint) => Math.max(max, QUALITY_ORDER[fingerprint.rank]),
    0,
  );

  return QUALITY_VALUES[maxOrder];
}

export interface BuildGroupedListenersInput {
  registry: AffixRegistry;
  translator: AffixEffectTranslator;
  affixIds: string[];
  quality: Quality;
  defaultListenerSpec: AffixListenerSpec;
}

export function buildGroupedListeners({
  registry,
  translator,
  affixIds,
  quality,
  defaultListenerSpec,
}: BuildGroupedListenersInput): ListenerConfig[] {
  const listenerMap = new Map<string, ListenerConfig>();

  for (const affixId of affixIds) {
    const definition = registry.queryById(affixId);
    if (!definition) {
      continue;
    }

    const effect = translator.translate(definition, quality);
    const spec = definition.listenerSpec ?? defaultListenerSpec;
    // Key design: (eventType, scope, priority) is the merge unit for listeners.
    // Affixes sharing the same triple are combined into a single ListenerConfig with
    // multiple effects. Affixes with different priorities produce independent listeners,
    // allowing different combat ordering. This is intentional — priority affects execution
    // order, so different-priority affixes must not be silently merged.
    const key = `${spec.eventType}||${spec.scope}||${spec.priority}`;

    if (!listenerMap.has(key)) {
      listenerMap.set(key, {
        eventType: spec.eventType,
        scope: spec.scope,
        priority: spec.priority,
        ...(spec.mapping ? { mapping: spec.mapping } : {}),
        ...(spec.guard ? { guard: spec.guard } : {}),
        effects: [],
      });
    }

    listenerMap.get(key)!.effects.push(effect);
  }

  return Array.from(listenerMap.values());
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

  const dominantQuality = getDominantQuality(materialFingerprints);

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
    energyBudget,
    affixes: rolledAffixes,
    sessionTags: session.state.tags,
    materialFingerprints,
    dominantQuality,
    materialNames: input.materials.map((m) => m.name),
    ...(coreEffectType !== undefined ? { coreEffectType } : {}),
  };
}