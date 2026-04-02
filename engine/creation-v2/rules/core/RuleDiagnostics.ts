import { RuleDiagnosticsSnapshot, RuleReason, RuleTraceEntry } from './types';

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

  merge(snapshot: Partial<RuleDiagnosticsSnapshot>): void {
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

  toSnapshot(): RuleDiagnosticsSnapshot {
    return {
      reasons: [...this.reasons],
      warnings: [...this.warnings],
      trace: [...this.trace],
    };
  }
}