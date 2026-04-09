import { EquipmentSlot } from '@/types/constants';
import { AttributeType, BuffType, ModifierType, StackRule } from '../contracts/battle';
import { CreationProductType } from '../types';

/**
 * CreationFallbackPolicy
 * 保底结果策略配置 — 控制 FallbackOutcomeRules 注入的保底效果参数
 */

/** 功法保底 buff 的身份标识 */
export const CREATION_FALLBACK_GONGFA_BUFF = {
  /** Buff id —— 全局唯一标识符 */
  id: 'gongfa-fallback-spirit',
  /** Buff 展示名称 */
  name: '基础灵脉',
  type: BuffType.BUFF,
  stackRule: StackRule.IGNORE,
  /** 修改的属性类型 */
  attrType: AttributeType.SPIRIT,
  modifierType: ModifierType.FIXED,
} as const;

/** decision.defaultsApplied 中注入的标记字符串 */
export const CREATION_FALLBACK_MARKERS = {
  skillDamageFallback: 'skill_damage_fallback',
  artifactCoreFallback: 'artifact_core_fallback',
  artifactShieldFallback: 'artifact_shield_fallback',
  gongfaSpiritFallback: 'gongfa_spirit_fallback',
} as const;

/**
 * 词缀池保底 core（按产物类型）。
 * 当标签匹配后 core 候选为空时，注入该 core 作为 deterministic fallback。
 */
export const CREATION_FALLBACK_CORE_AFFIX: Record<CreationProductType, string> = {
  skill: 'skill-core-damage',
  artifact: 'artifact-core-weapon-dual-edge',
  gongfa: 'gongfa-core-spirit',
};

export const CREATION_FALLBACK_ARTIFACT_CORE_AFFIX: Record<EquipmentSlot, string> = {
  weapon: 'artifact-core-weapon-dual-edge',
  armor: 'artifact-core-armor-dual-ward',
  accessory: 'artifact-core-accessory-omen',
};
