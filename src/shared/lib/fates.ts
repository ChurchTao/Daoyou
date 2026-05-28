import type {
  FateEffectEntry,
  PreHeavenFate,
} from '@shared/types/cultivator';

export interface FateContext {
  retreatExpMultiplier: number;
  retreatInsightMultiplier: number;
  breakthroughChanceBonus: number;
  naturalRecoveryMultiplier: number;
  toxicityPenaltyMultiplier: number;
  alchemySpiritStoneMultiplier: number;
  refineSpiritStoneMultiplier: number;
  enlightenmentInsightMultiplier: number;
  innCultivationLossMultiplier: number;
  systemSpiritStoneMultiplier: number;
  summary: string;
}

const FATE_LIMITS = {
  retreatExpMultiplier: { min: 0.55, max: 1.8 },
  retreatInsightMultiplier: { min: 0.55, max: 1.9 },
  breakthroughChanceBonus: { min: -0.1, max: 0.15 },
  naturalRecoveryMultiplier: { min: 0.6, max: 2 },
  toxicityPenaltyMultiplier: { min: 0.45, max: 1.65 },
  alchemySpiritStoneMultiplier: { min: 0.65, max: 1.3 },
  refineSpiritStoneMultiplier: { min: 0.7, max: 1.3 },
  enlightenmentInsightMultiplier: { min: 0.65, max: 1.3 },
  innCultivationLossMultiplier: { min: 0, max: 1.3 },
  systemSpiritStoneMultiplier: { min: 0.7, max: 1.3 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function summarizeEffects(effects: FateEffectEntry[]): string {
  return effects.map((effect) => effect.label).join('、');
}

export function normalizeFate(fate: PreHeavenFate): PreHeavenFate {
  return {
    ...fate,
    effects: fate.effects ?? [],
  };
}

export function normalizeFates(fates: PreHeavenFate[]): PreHeavenFate[] {
  return fates.map(normalizeFate);
}

export function evaluateFateContext(fates: PreHeavenFate[]): FateContext {
  const normalized = normalizeFates(fates);
  let retreatExpMultiplier = 1;
  let retreatInsightMultiplier = 1;
  let breakthroughChanceBonus = 0;
  let naturalRecoveryMultiplier = 1;
  let toxicityPenaltyMultiplier = 1;
  let alchemySpiritStoneMultiplier = 1;
  let refineSpiritStoneMultiplier = 1;
  let enlightenmentInsightMultiplier = 1;
  let innCultivationLossReduction = 0;
  let systemSpiritStoneMultiplier = 1;

  for (const fate of normalized) {
    for (const effect of fate.effects ?? []) {
      switch (effect.effectType) {
        case 'retreat_exp_multiplier':
          retreatExpMultiplier *= effect.value;
          break;
        case 'retreat_insight_multiplier':
          retreatInsightMultiplier *= effect.value;
          break;
        case 'breakthrough_bonus':
          breakthroughChanceBonus += effect.value;
          break;
        case 'natural_recovery_multiplier':
          naturalRecoveryMultiplier *= effect.value;
          break;
        case 'toxicity_penalty_multiplier':
          toxicityPenaltyMultiplier *= effect.value;
          break;
        case 'alchemy_spirit_stone_multiplier':
          alchemySpiritStoneMultiplier *= effect.value;
          break;
        case 'refine_spirit_stone_multiplier':
          refineSpiritStoneMultiplier *= effect.value;
          break;
        case 'enlightenment_insight_multiplier':
          enlightenmentInsightMultiplier *= effect.value;
          break;
        case 'inn_cultivation_loss_multiplier':
          innCultivationLossReduction += 1 - effect.value;
          break;
        case 'system_spirit_stone_multiplier':
          systemSpiritStoneMultiplier *= effect.value;
          break;
      }
    }
  }

  return {
    retreatExpMultiplier: clamp(
      retreatExpMultiplier,
      FATE_LIMITS.retreatExpMultiplier.min,
      FATE_LIMITS.retreatExpMultiplier.max,
    ),
    retreatInsightMultiplier: clamp(
      retreatInsightMultiplier,
      FATE_LIMITS.retreatInsightMultiplier.min,
      FATE_LIMITS.retreatInsightMultiplier.max,
    ),
    breakthroughChanceBonus: clamp(
      breakthroughChanceBonus,
      FATE_LIMITS.breakthroughChanceBonus.min,
      FATE_LIMITS.breakthroughChanceBonus.max,
    ),
    naturalRecoveryMultiplier: clamp(
      naturalRecoveryMultiplier,
      FATE_LIMITS.naturalRecoveryMultiplier.min,
      FATE_LIMITS.naturalRecoveryMultiplier.max,
    ),
    toxicityPenaltyMultiplier: clamp(
      toxicityPenaltyMultiplier,
      FATE_LIMITS.toxicityPenaltyMultiplier.min,
      FATE_LIMITS.toxicityPenaltyMultiplier.max,
    ),
    alchemySpiritStoneMultiplier: clamp(
      alchemySpiritStoneMultiplier,
      FATE_LIMITS.alchemySpiritStoneMultiplier.min,
      FATE_LIMITS.alchemySpiritStoneMultiplier.max,
    ),
    refineSpiritStoneMultiplier: clamp(
      refineSpiritStoneMultiplier,
      FATE_LIMITS.refineSpiritStoneMultiplier.min,
      FATE_LIMITS.refineSpiritStoneMultiplier.max,
    ),
    enlightenmentInsightMultiplier: clamp(
      enlightenmentInsightMultiplier,
      FATE_LIMITS.enlightenmentInsightMultiplier.min,
      FATE_LIMITS.enlightenmentInsightMultiplier.max,
    ),
    innCultivationLossMultiplier: clamp(
      1 - innCultivationLossReduction,
      FATE_LIMITS.innCultivationLossMultiplier.min,
      FATE_LIMITS.innCultivationLossMultiplier.max,
    ),
    systemSpiritStoneMultiplier: clamp(
      systemSpiritStoneMultiplier,
      FATE_LIMITS.systemSpiritStoneMultiplier.min,
      FATE_LIMITS.systemSpiritStoneMultiplier.max,
    ),
    summary: normalized
      .map((fate) => {
        const summary = summarizeEffects(fate.effects ?? []);
        return summary ? `${fate.name}：${summary}` : fate.name;
      })
      .join(' | '),
  };
}

export function getAlchemySpiritStoneMultiplier(context: FateContext): number {
  return clamp(
    context.alchemySpiritStoneMultiplier * context.systemSpiritStoneMultiplier,
    FATE_LIMITS.alchemySpiritStoneMultiplier.min,
    FATE_LIMITS.alchemySpiritStoneMultiplier.max,
  );
}

export function getRefineSpiritStoneMultiplier(context: FateContext): number {
  return clamp(
    context.refineSpiritStoneMultiplier * context.systemSpiritStoneMultiplier,
    FATE_LIMITS.refineSpiritStoneMultiplier.min,
    FATE_LIMITS.refineSpiritStoneMultiplier.max,
  );
}

export function getInnSpiritStoneMultiplier(context: FateContext): number {
  return clamp(
    context.systemSpiritStoneMultiplier,
    FATE_LIMITS.systemSpiritStoneMultiplier.min,
    FATE_LIMITS.systemSpiritStoneMultiplier.max,
  );
}

export function scaleFateAdjustedValue(
  baseValue: number,
  multiplier: number,
): number {
  return Math.max(0, Math.round(Math.max(0, baseValue) * multiplier));
}
