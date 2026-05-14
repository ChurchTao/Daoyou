/*
 * rules/core/types.ts: 规则诊断与决策元信息类型定义。
 * 包含 RuleDecisionMeta、RuleReason、RuleTraceEntry 等接口，用于在规则执行期间
 * 传递并收集可审计的决策依据与诊断轨迹。
 */
export type RuleTraceOutcome = 'applied' | 'skipped' | 'blocked';

export interface RuleReason {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface RuleTraceEntry {
  ruleId: string;
  outcome: RuleTraceOutcome;
  message?: string;
  details?: Record<string, unknown>;
}

export interface RuleDecisionMeta {
  reasons: RuleReason[];
  warnings: RuleReason[];
  trace: RuleTraceEntry[];
}

