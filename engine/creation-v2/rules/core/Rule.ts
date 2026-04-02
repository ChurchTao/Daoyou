import { RuleContext } from './RuleContext';
import { RuleDecisionMeta } from './types';

export interface Rule<TFacts, TDecision extends RuleDecisionMeta> {
  readonly id: string;
  apply(context: RuleContext<TFacts, TDecision>): void;
}