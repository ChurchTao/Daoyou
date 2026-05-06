'use client';

import { formatFateTagLabel } from '@/lib/services/FateFragmentRegistry';
import type {
  FateEffectEntry,
  FateEffectScope,
  PreHeavenFate,
} from '@/types/cultivator';
import type { Quality } from '@/types/constants';

export interface FateDetailGroup {
  key: string;
  title: string;
  lines: string[];
}

export interface FateDisplayModel {
  name: string;
  quality?: Quality;
  description?: string;
  qualityTone?: Quality;
  coreTags: string[];
  previewLines: string[];
  detailGroups: FateDetailGroup[];
}

function scoreEffect(effect: FateEffectEntry): number {
  const base =
    effect.extreme === 'extreme'
      ? 3
      : effect.extreme === 'strong'
        ? 2
        : 1;
  const polarityBonus = effect.polarity === 'boon' ? 0.5 : 0;
  return base + polarityBonus;
}

function sortEffects(effects: FateEffectEntry[]): FateEffectEntry[] {
  return [...effects].sort((left, right) => scoreEffect(right) - scoreEffect(left));
}

function groupEffects(effects: FateEffectEntry[]): FateDetailGroup[] {
  const creation = effects
    .filter((effect) => effect.scope === 'creation' && effect.polarity === 'boon')
    .map((effect) => effect.label);
  const cultivation = effects
    .filter(
      (effect) =>
        (effect.scope === 'cultivation' || effect.scope === 'breakthrough') &&
        effect.polarity === 'boon',
    )
    .map((effect) => effect.label);
  const world = effects
    .filter((effect) => effect.scope === 'world' && effect.polarity === 'boon')
    .map((effect) => effect.label);
  const burdens = effects
    .filter((effect) => effect.polarity === 'burden')
    .map((effect) => effect.label);

  return [
    creation.length > 0
      ? { key: 'creation', title: '造物偏置', lines: creation }
      : null,
    cultivation.length > 0
      ? { key: 'cultivation', title: '修炼收益', lines: cultivation }
      : null,
    world.length > 0 ? { key: 'world', title: '天机机缘', lines: world } : null,
    burdens.length > 0
      ? { key: 'burden', title: '代价反噬', lines: burdens }
      : null,
  ].filter(Boolean) as FateDetailGroup[];
}

export function toFateDisplayModel(fate: PreHeavenFate): FateDisplayModel {
  const effects = sortEffects(fate.effects ?? []);
  const previewLines = [
    ...effects.filter((effect) => effect.polarity === 'boon').slice(0, 2),
    ...effects.filter((effect) => effect.polarity === 'burden').slice(0, 1),
  ]
    .slice(0, 3)
    .map((effect) => effect.label);

  return {
    name: fate.name,
    quality: fate.quality,
    description: fate.description,
    qualityTone: fate.quality,
    coreTags: (fate.tags ?? []).slice(0, 4).map((tag) => formatFateTagLabel(tag)),
    previewLines,
    detailGroups: groupEffects(effects),
  };
}
