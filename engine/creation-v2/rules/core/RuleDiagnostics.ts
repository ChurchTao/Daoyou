import { RuleDecisionMeta, RuleReason, RuleTraceEntry } from './types';

/*
 * RuleDiagnostics: 规则执行期间用于收集 reasons/warnings/trace 的工具类。
 * Rules 在上下文中调用 diagnostics.addReason/addWarning/addTrace 来记录决策依据与调试信息，
 * 最终由 RuleSet 汇总并合并回 Decision，以便审计与测试。
 */
export class RuleDiagnostics {
  private readonly reasons: RuleReason[] = [];
  private readonly warnings: RuleReason[] = [];
  private readonly trace: RuleTraceEntry[] = [];

  addReason(reason: RuleReason): void {
    this.reasons.push(reason);
  }

  addWarning(warning: RuleReason): void {
    this.warnings.push(warning);
  }

  addTrace(entry: RuleTraceEntry): void {
    this.trace.push(entry);
  }

  merge(snapshot: Partial<RuleDecisionMeta>): void {
    if (snapshot.reasons) {
      this.reasons.push(...snapshot.reasons);
    }

    if (snapshot.warnings) {
      this.warnings.push(...snapshot.warnings);
    }

    if (snapshot.trace) {
      this.trace.push(...snapshot.trace);
    }
  }

  toSnapshot(): RuleDecisionMeta {
    return {
      reasons: [...this.reasons],
      warnings: [...this.warnings],
      trace: [...this.trace],
    };
  }
}