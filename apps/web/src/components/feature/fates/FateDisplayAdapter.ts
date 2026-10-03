import type {
  FateEffectEntry,
  PreHeavenFate,
} from '@daoyou/shared/types/cultivator';
import type { Quality } from '@daoyou/shared/types/constants';

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
  previewLines: string[];
  detailGroups: FateDetailGroup[];
}

function sortEffects(effects: FateEffectEntry[]): FateEffectEntry[] {
  return [...effects].sort((left, right) => {
    if (left.polarity === right.polarity) return 0;
    return left.polarity === 'boon' ? -1 : 1;
  });
}

function groupEffects(effects: FateEffectEntry[]): FateDetailGroup[] {
  const daily = effects
    .filter((effect) => effect.scope === 'daily' && effect.polarity === 'boon')
    .map((effect) => effect.label);
  const burdens = effects
    .filter((effect) => effect.polarity === 'burden')
    .map((effect) => effect.label);

  return [
    daily.length > 0
      ? { key: 'daily', title: '修行偏性', lines: daily }
      : null,
    burdens.length > 0
      ? { key: 'burden', title: '代价反噬', lines: burdens }
      : null,
  ].filter(Boolean) as FateDetailGroup[];
}

export function toFateDisplayModel(fate: PreHeavenFate): FateDisplayModel {
  const effects = sortEffects(fate.effects ?? []);
  const previewLines = [
    ...effects.filter((effect) => effect.polarity === 'boon').slice(0, 1),
    ...effects.filter((effect) => effect.polarity === 'burden').slice(0, 1),
  ]
    .slice(0, 2)
    .map((effect) => effect.label);

  return {
    name: fate.name,
    quality: fate.quality,
    description: fate.description,
    qualityTone: fate.quality,
    previewLines,
    detailGroups: groupEffects(effects),
  };
}
