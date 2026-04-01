import { CreationProductType } from '../types';
import { CREATION_EVENT_PRIORITY_LEVELS } from './CreationEventPriorities';

export const CREATION_AFFIX_UNLOCK_THRESHOLDS = {
  prefix: 12,
  suffix: 20,
  signature: 32,
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