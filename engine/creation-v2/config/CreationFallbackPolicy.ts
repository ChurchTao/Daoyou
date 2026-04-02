import { AttributeType, BuffType, ModifierType, StackRule } from '../contracts/battle';

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
  artifactShieldFallback: 'artifact_shield_fallback',
  gongfaSpiritFallback: 'gongfa_spirit_fallback',
} as const;
