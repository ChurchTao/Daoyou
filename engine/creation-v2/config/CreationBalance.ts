import { CreationProductType } from '../types';
import { CREATION_EVENT_PRIORITY_LEVELS } from './CreationEventPriorities';

export const CREATION_AFFIX_UNLOCK_THRESHOLDS = {
  prefix: 12,
  suffix: 20,
  resonance: 26,
  signature: 32,
  synergy: 38,
  mythic: 46,
} as const;

export const CREATION_RESERVED_ENERGY: Record<CreationProductType, number> = {
  skill: 6,
  artifact: 4,
  gongfa: 4,
};

export const CREATION_SKILL_DEFAULTS = {
  minDamageBase: 12,
  minMpCost: 10,
  healCooldown: 1,
  damageCooldown: 2,
  buffCooldown: 3,
};

export const CREATION_PASSIVE_DEFAULTS = {
  minArtifactShieldBase: 10,
  minGongFaHealBase: 8,
};

export const CREATION_MATERIAL_ENERGY = {
  quantityFactor: 4,
  manualBonus: 4,
  specializedManualBonus: 6,
};

export const CREATION_LISTENER_PRIORITIES = {
  actionPreBuff: CREATION_EVENT_PRIORITY_LEVELS.ACTION_TRIGGER,
  skillCast: CREATION_EVENT_PRIORITY_LEVELS.SKILL_CAST,
  damageRequest: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_REQUEST,
  damageApply: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_APPLY,
  damageApplyImmunity: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_APPLY + 1,
  damageTaken: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_TAKEN,
  roundPre: CREATION_EVENT_PRIORITY_LEVELS.ROUND_PRE,
  buffIntercept: CREATION_EVENT_PRIORITY_LEVELS.BUFF_INTERCEPT,
} as const;

export const CREATION_PROJECTION_BALANCE = {
  /**
   * Skill ability priority = base + number of affixes.
   * Base of 10 aligns with the battle engine's "normal skill" priority tier
   * (0–9 = passive/reactives, 10+ = active skills). Each affix increments by 1,
   * so skills never exceed 14 for the 4-affix cap.
   */
  skillPriorityBase: 10,
  /**
   * Skill mp cost = round(energyBudget.total / mpCostDivisor), min 10.
   * Divisor of 3 means a 30-energy budget yields mp cost ~10 (minimum).
   * A 60-energy budget yields ~20, matching mid-tier skill costs.
   */
  mpCostDivisor: 3,
  /**
   * Artifact fallback shield base = energyBudget.remaining / shieldBaseDivisor.
   * Divisor of 1.5 converts remaining energy to a shield value roughly equal
   * to 2/3 of remaining energy, calibrated against average HP values ~100–200.
   */
  artifactShieldBaseDivisor: 1.5,
  /**
   * Maximum number of affixes a single crafted item can have.
   * Hard upper bound: 1 core + 1 prefix + 1 suffix + 1 signature = 4.
   * Increasing this requires adding new affix unlock tiers in CREATION_AFFIX_UNLOCK_THRESHOLDS.
   */
  defaultMaxAffixCount: 4,
  /** Permanent buff duration sentinel: -1 means no expiry */
  permanentBuffDuration: -1,
  /** GongFa fallback spirit buff base value */
  gongfaSpiritBuffBase: 3,
} as const;