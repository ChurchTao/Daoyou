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

export interface RuleDiagnosticsSnapshot extends RuleDecisionMeta {}