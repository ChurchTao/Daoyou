/**
 * CreationRulePolicy
 * 规则引擎通用策略配置 — 控制 CompositionRuleSet 等规则集的执行行为
 */

/** RuleDiagnostics trace outcome 字符串常量（与 RuleTraceOutcome = 'applied' | 'skipped' | 'blocked' 对齐） */
export const CREATION_RULE_OUTCOMES = {
  applied: 'applied',
  skipped: 'skipped',
  blocked: 'blocked',
} as const;

export type CreationRuleOutcome =
  (typeof CREATION_RULE_OUTCOMES)[keyof typeof CREATION_RULE_OUTCOMES];

/** 规则阶段执行顺序（与 CompositionRuleSet 中的 phases 数组对应） */
export const COMPOSITION_RULE_PHASE_ORDER = [
  'composition.outcome_tags',
  'composition.naming',
  'composition.energy_conversion',
  'composition.projection',
  'composition.fallback_outcome',
] as const;

export type CompositionRulePhaseId = (typeof COMPOSITION_RULE_PHASE_ORDER)[number];
