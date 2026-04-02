/*
 * RuleSet: 规则执行框架的门面。
 * 责任：按顺序执行传入的 Rule 列表，收集 RuleDiagnostics，并将 diagnostics 合并回 Decision。
 * 该类为 rules 层提供统一的 evaluate(facts) -> decision 流程。
 */
import { Rule } from './Rule';
import { RuleContextMetadata } from './RuleContext';
import { RuleDiagnostics } from './RuleDiagnostics';
import { RuleDecisionMeta } from './types';

/*
 * RuleSet: 规则执行框架的门面。
 * 说明：按顺序执行 Rule[]，并将 RuleDiagnostics 合并到最终 Decision（reasons/warnings/trace）。
 * Rule 的实现应通过 RuleContext dagnostics 记录可审计的变更说明。
 */
export class RuleSet<TFacts, TDecision extends RuleDecisionMeta> {
  constructor(
    private readonly rules: readonly Rule<TFacts, TDecision>[],
    private readonly createDecision: (
      facts: TFacts,
      seed?: Partial<TDecision>,
    ) => TDecision,
  ) {}

  evaluate(
    facts: TFacts,
    options: {
      seed?: Partial<TDecision>;
      metadata?: RuleContextMetadata;
    } = {},
  ): TDecision {
    const decision = this.createDecision(facts, options.seed);
    const diagnostics = new RuleDiagnostics();
    const context = {
      facts,
      decision,
      diagnostics,
      metadata: options.metadata ?? {},
    };

    for (const rule of this.rules) {
      rule.apply(context);
    }

    const snapshot = diagnostics.toSnapshot();
    decision.reasons.push(...snapshot.reasons);
    decision.warnings.push(...snapshot.warnings);
    decision.trace.push(...snapshot.trace);

    return decision;
  }
}