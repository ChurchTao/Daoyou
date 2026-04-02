/*
 * rules/core/index.ts: 规则引擎核心导出。
 * 说明：对外暴露 Rule 接口、RuleContext、RuleSet 及 RuleDiagnostics 等构件，
 * 便于各规则集合与规则实现引用与测试。
 */
export type { Rule } from './Rule';
export type { RuleContext, RuleContextMetadata } from './RuleContext';
export { RuleDiagnostics } from './RuleDiagnostics';
export { RuleSet } from './RuleSet';
export type {
  RuleDecisionMeta,
  RuleDiagnosticsSnapshot,
  RuleReason,
  RuleTraceEntry,
  RuleTraceOutcome,
} from './types';