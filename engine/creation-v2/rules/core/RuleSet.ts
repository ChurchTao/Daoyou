import { Rule } from './Rule';
import { RuleContextMetadata } from './RuleContext';
import { RuleDiagnostics } from './RuleDiagnostics';
import { RuleDecisionMeta } from './types';

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