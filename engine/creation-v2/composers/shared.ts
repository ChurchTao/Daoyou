import { QUALITY_ORDER, QUALITY_VALUES, Quality } from '@/types/constants';
import { AffixEffectTranslator } from '../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../affixes/AffixRegistry';
import type { AffixListenerSpec } from '../affixes/types';
import type { ListenerConfig } from '../contracts/battle';
import type { MaterialFingerprint, RolledAffix } from '../types';

export function getDominantQuality(
  fingerprints: MaterialFingerprint[],
): Quality {
  const maxOrder = fingerprints.reduce(
    (max, fingerprint) => Math.max(max, QUALITY_ORDER[fingerprint.rank]),
    0,
  );

  return QUALITY_VALUES[maxOrder];
}

interface BuildGroupedListenersInput {
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

  for (const rolledAffix of rolledAffixes) {
    const definition = registry.queryById(rolledAffix.id);
    if (!definition) {
      continue;
    }

    const effect = translator.translate(definition, quality);
    const spec = definition.listenerSpec ?? defaultListenerSpec;
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