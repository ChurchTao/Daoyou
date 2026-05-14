import { CreationTags } from '@shared/engine/shared/tag-domain';
import type {
  FateEffectEntry,
  PreHeavenFate,
} from '@shared/types/cultivator';

export interface FateGrowthContext {
  cultivationExpMultiplier: number;
  insightGainMultiplier: number;
  breakthroughChanceBonus: number;
  summary: string;
}

const TAG_LABELS: Record<string, string> = {
  [CreationTags.MATERIAL.SEMANTIC_BLADE]: '锋刃',
  [CreationTags.MATERIAL.SEMANTIC_METAL]: '金铁',
  [CreationTags.MATERIAL.SEMANTIC_ALCHEMY]: '丹道',
  [CreationTags.MATERIAL.SEMANTIC_WOOD]: '草木',
  [CreationTags.MATERIAL.SEMANTIC_SUSTAIN]: '疗养',
  [CreationTags.MATERIAL.SEMANTIC_THUNDER]: '雷霆',
  [CreationTags.MATERIAL.SEMANTIC_BURST]: '爆发',
  [CreationTags.MATERIAL.SEMANTIC_GUARD]: '守御',
  [CreationTags.MATERIAL.SEMANTIC_EARTH]: '厚土',
  [CreationTags.MATERIAL.SEMANTIC_SPIRIT]: '神识',
  [CreationTags.MATERIAL.SEMANTIC_MANUAL]: '典籍',
  [CreationTags.MATERIAL.SEMANTIC_SPACE]: '界隙',
  [CreationTags.MATERIAL.SEMANTIC_WATER]: '流波',
  [CreationTags.MATERIAL.SEMANTIC_TIME]: '岁序',
  [CreationTags.MATERIAL.SEMANTIC_QI]: '灵气',
  [CreationTags.MATERIAL.SEMANTIC_BLOOD]: '血煞',
  [CreationTags.MATERIAL.SEMANTIC_BEAST]: '妖性',
  [CreationTags.MATERIAL.SEMANTIC_WIND]: '流岚',
  [CreationTags.MATERIAL.SEMANTIC_ILLUSION]: '幻术',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function summarizeEffects(effects: FateEffectEntry[]): string {
  return effects.map((effect) => effect.label).join('、');
}

export function formatFateTagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag.split('.').pop() ?? tag;
}

export function normalizeFate(fate: PreHeavenFate): PreHeavenFate {
  return {
    ...fate,
    tags: fate.tags ?? [],
    effects: fate.effects ?? [],
  };
}

export function normalizeFates(fates: PreHeavenFate[]): PreHeavenFate[] {
  return fates.map(normalizeFate);
}

export function evaluateFateGrowthContext(
  fates: PreHeavenFate[],
): FateGrowthContext {
  const normalized = normalizeFates(fates);
  let cultivationExpMultiplier = 1;
  let insightGainMultiplier = 1;
  let breakthroughChanceBonus = 0;

  for (const fate of normalized) {
    for (const effect of fate.effects ?? []) {
      if (effect.effectType === 'cultivation_exp_multiplier') {
        cultivationExpMultiplier *= effect.value;
      }
      if (effect.effectType === 'insight_gain_multiplier') {
        insightGainMultiplier *= effect.value;
      }
      if (effect.effectType === 'breakthrough_bonus') {
        breakthroughChanceBonus += effect.value;
      }
    }
  }

  return {
    cultivationExpMultiplier: clamp(cultivationExpMultiplier, 0.45, 2),
    insightGainMultiplier: clamp(insightGainMultiplier, 0.45, 2.2),
    breakthroughChanceBonus: clamp(breakthroughChanceBonus, -0.25, 0.25),
    summary: normalized
      .map((fate) => {
        const summary = summarizeEffects(fate.effects ?? []);
        return summary ? `${fate.name}：${summary}` : fate.name;
      })
      .join(' | '),
  };
}
