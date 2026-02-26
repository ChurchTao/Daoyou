import { EffectConfig, StatModifierType } from '@/engine/effect/types';
import { Quality } from '@/types/constants';
import {
  Artifact,
  Consumable,
  CultivationTechnique,
  Skill,
} from '@/types/cultivator';

const QUALITY_SCORE_MAP: Record<Quality, number> = {
  凡品: 80,
  灵品: 180,
  玄品: 360,
  真品: 700,
  地品: 1300,
  天品: 2400,
  仙品: 4300,
  神品: 7600,
};

const SKILL_GRADE_SCORE_MAP: Record<string, number> = {
  天阶上品: 4200,
  天阶中品: 3500,
  天阶下品: 2900,
  地阶上品: 2300,
  地阶中品: 1900,
  地阶下品: 1550,
  玄阶上品: 1150,
  玄阶中品: 900,
  玄阶下品: 700,
  黄阶上品: 520,
  黄阶中品: 360,
  黄阶下品: 240,
};

const STAT_WEIGHT_MAP: Record<string, number> = {
  vitality: 1.15,
  spirit: 1.15,
  wisdom: 1.05,
  speed: 1.1,
  willpower: 1.0,
  critRate: 2.8,
  critDamage: 2.0,
  hitRate: 1.6,
  dodgeRate: 1.8,
  damageReduction: 2.4,
  flatDamageReduction: 1.4,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const normalizePercent = (value: number): number => {
  const absValue = Math.abs(value);
  return absValue <= 1 ? absValue * 100 : absValue;
};

function getEffectScore(effect: EffectConfig): number {
  const params = (effect.params ?? {}) as Record<string, unknown>;

  let score = 20;

  switch (effect.type) {
    case 'StatModifier':
    case 'ConsumeStatModifier': {
      const stat = String(params.stat ?? '');
      const value = asNumber(params.value);
      const modType = asNumber(params.modType, StatModifierType.FIXED);
      const statWeight = STAT_WEIGHT_MAP[stat] ?? 1;

      if (
        modType === StatModifierType.PERCENT ||
        modType === StatModifierType.FINAL
      ) {
        score = normalizePercent(value) * statWeight * 8;
      } else {
        score = Math.abs(value) * statWeight * 1.6;
      }
      break;
    }

    case 'Damage': {
      const multiplier = asNumber(params.multiplier);
      const flatDamage = asNumber(params.flatDamage);
      const critRateBonus = asNumber(params.critRateBonus);
      const critDamageBonus = asNumber(params.critDamageBonus);

      score =
        multiplier * 240 +
        flatDamage * 1.2 +
        normalizePercent(critRateBonus) * 9 +
        normalizePercent(critDamageBonus) * 5;

      if (params.ignoreDefense === true) score += 120;
      if (params.ignoreShield === true) score += 80;
      break;
    }

    case 'BonusDamage': {
      score = asNumber(params.multiplier) * 180;
      if (params.canCrit === true) score += 40;
      break;
    }

    case 'TrueDamage': {
      score = asNumber(params.baseDamage) * 1.7;
      if (params.ignoreReduction === true) score += 90;
      if (params.ignoreShield === true) score += 60;
      break;
    }

    case 'ExecuteDamage': {
      score =
        normalizePercent(asNumber(params.thresholdPercent)) * 8 +
        asNumber(params.bonusDamage) * 160;
      if (params.affectShield === true) score += 40;
      break;
    }

    case 'DotDamage': {
      score = asNumber(params.baseDamage) * 1.25;
      if (params.usesCasterStats === true) score += 35;
      break;
    }

    case 'Heal': {
      const multiplier = asNumber(params.multiplier);
      const flatHeal = asNumber(params.flatHeal);
      score = multiplier * 200 + flatHeal * 1.05;
      if (params.targetSelf === false) score *= 1.05;
      break;
    }

    case 'AddBuff': {
      const chance = clamp(asNumber(params.chance, 1), 0, 1);
      const duration = Math.max(1, asNumber(params.durationOverride, 2));
      const initialStacks = Math.max(1, asNumber(params.initialStacks, 1));
      score = 80 + chance * 120 + duration * 25 + initialStacks * 18;
      break;
    }

    case 'RemoveBuff': {
      score = 90;
      break;
    }

    case 'Shield': {
      score =
        asNumber(params.amount) * 1.1 + Math.max(0, asNumber(params.duration)) * 30;
      break;
    }

    case 'LifeSteal': {
      score = normalizePercent(asNumber(params.stealPercent)) * 16;
      break;
    }

    case 'ReflectDamage': {
      score = normalizePercent(asNumber(params.reflectPercent)) * 14;
      break;
    }

    case 'Critical': {
      score =
        normalizePercent(asNumber(params.critRateBonus)) * 10 +
        normalizePercent(asNumber(params.critDamageBonus)) * 6;
      break;
    }

    case 'DamageReduction': {
      score =
        asNumber(params.flatReduction) * 1.2 +
        normalizePercent(asNumber(params.percentReduction)) * 13;
      break;
    }

    case 'ElementDamageBonus': {
      score = normalizePercent(asNumber(params.damageBonus)) * 12;
      break;
    }

    case 'HealAmplify': {
      score = normalizePercent(asNumber(params.amplifyPercent)) * 9;
      break;
    }

    case 'ManaRegen': {
      score =
        asNumber(params.amount) * 1.4 +
        normalizePercent(asNumber(params.percentOfMax)) * 5;
      break;
    }

    case 'ManaDrain': {
      score =
        asNumber(params.drainAmount) * 1.2 +
        normalizePercent(asNumber(params.drainPercent)) * 7;
      break;
    }

    case 'Dispel': {
      score = asNumber(params.dispelCount, 1) * 90;
      if (params.dispelType === 'all') score += 40;
      break;
    }

    case 'CounterAttack': {
      score =
        normalizePercent(asNumber(params.chance)) * 5 +
        asNumber(params.damageMultiplier) * 120;
      break;
    }

    case 'ConsumeAddBuff': {
      score = 120;
      if (asNumber(params.maxUses, 0) > 0) score += asNumber(params.maxUses) * 8;
      if (asNumber(params.expiryMinutes, 0) > 0) {
        score += Math.min(asNumber(params.expiryMinutes) / 10, 40);
      }
      break;
    }

    case 'ConsumeGainCultivationExp':
    case 'ConsumeGainComprehension':
    case 'ConsumeGainLifespan': {
      score = asNumber(params.value) * 0.65;
      break;
    }

    case 'RetreatCultivationBonus':
    case 'RetreatComprehensionBonus':
    case 'BreakthroughChanceBonus': {
      score = normalizePercent(asNumber(params.bonusPercent)) * 28;
      break;
    }

    default: {
      score = 25;
      break;
    }
  }

  if (effect.isPerfect === true) {
    score *= 1.08;
  }

  return Math.max(0, score);
}

function getEffectsTotalScore(effects: EffectConfig[] | undefined): number {
  if (!effects || effects.length === 0) {
    return 0;
  }

  return effects.reduce((acc, effect) => acc + getEffectScore(effect), 0);
}

/**
 * 计算单个法宝评分
 */
export function calculateSingleArtifactScore(artifact: Artifact): number {
  const base = QUALITY_SCORE_MAP[artifact.quality || '凡品'] || 80;
  const effects = artifact.effects ?? [];
  const effectsScore = getEffectsTotalScore(effects);
  const uniqueEffectTypes = new Set(effects.map((effect) => effect.type)).size;

  const specialEffectCount = effects.filter(
    (effect) => effect.type !== 'StatModifier',
  ).length;

  const score =
    base +
    effectsScore * 1.18 +
    uniqueEffectTypes * 35 +
    specialEffectCount * 45;

  const countMultiplier = 1 + Math.min(0.25, effects.length * 0.05);
  return Math.floor(Math.max(1, score * countMultiplier));
}

/**
 * 计算单个神通评分
 */
export function calculateSingleSkillScore(skill: Skill): number {
  const base = SKILL_GRADE_SCORE_MAP[skill.grade || '黄阶下品'] || 240;
  const effects = skill.effects ?? [];
  const effectsScore = getEffectsTotalScore(effects);

  const manaCost = Math.max(0, skill.cost || 0);
  const cooldown = Math.max(0, skill.cooldown || 0);
  const actionTax = 40 + manaCost + cooldown * 18;
  const efficiency = clamp((effectsScore + base * 0.3) / actionTax, 0.75, 1.3);

  const complexityMultiplier = 1 + Math.min(0.24, effects.length * 0.04);
  const targetModifier = skill.target_self ? 0.96 : 1;

  const score =
    (base + effectsScore * 1.05) *
    efficiency *
    complexityMultiplier *
    targetModifier;
  return Math.floor(Math.max(1, score));
}

/**
 * 计算单个丹药评分
 */
export function calculateSingleElixirScore(consumable: Consumable): number {
  const base = QUALITY_SCORE_MAP[consumable.quality || '凡品'] || 80;
  const effects = consumable.effects ?? [];
  const effectsScore = getEffectsTotalScore(effects);
  const utilityBoost = effects.some(
    (effect) =>
      effect.type === 'ConsumeGainCultivationExp' ||
      effect.type === 'ConsumeGainComprehension' ||
      effect.type === 'ConsumeGainLifespan' ||
      effect.type === 'ConsumeAddBuff',
  )
    ? 120
    : 0;

  const score = base * 0.72 + effectsScore * 1.35 + utilityBoost;
  return Math.floor(Math.max(1, score));
}

/**
 * 计算单个功法评分
 */
export function calculateSingleTechniqueScore(
  technique: CultivationTechnique,
): number {
  const base = SKILL_GRADE_SCORE_MAP[technique.grade || '黄阶下品'] || 240;
  const effects = technique.effects ?? [];
  const effectsScore = getEffectsTotalScore(effects);
  const score = base * 0.9 + effectsScore * 1.15 + effects.length * 28;
  return Math.floor(Math.max(1, score));
}
