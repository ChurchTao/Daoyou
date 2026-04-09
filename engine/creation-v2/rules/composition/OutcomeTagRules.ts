import { CreationTags } from '../../core/GameplayTags';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import { CompositionDecision } from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';

/**
 * OutcomeTagRules
 * 根据产物类型和元素偏向填充 outcomeKind 与 tags
 */
export class OutcomeTagRules implements Rule<CompositionFacts, CompositionDecision> {
  readonly id = 'composition.outcome_tags';

  apply({
    facts,
    decision,
    diagnostics,
  }: RuleContext<CompositionFacts, CompositionDecision>): void {
    const { productType, intent } = facts;

    switch (productType) {
      case 'skill': {
        decision.outcomeKind = facts.outcomeKind;
        decision.tags = [
          CreationTags.OUTCOME.ACTIVE_SKILL,
          ...intent.dominantTags,
        ];
        break;
      }
      case 'artifact':
        decision.outcomeKind = facts.outcomeKind;
        decision.tags = [
          CreationTags.OUTCOME.PASSIVE_ABILITY,
          CreationTags.OUTCOME.ARTIFACT,
          ...intent.dominantTags,
        ];
        break;
      case 'gongfa':
        decision.outcomeKind = facts.outcomeKind;
        decision.tags = [
          CreationTags.OUTCOME.PASSIVE_ABILITY,
          CreationTags.OUTCOME.GONGFA,
          ...intent.dominantTags,
        ];
        break;
      default: {
        const _exhaustive: never = productType;
        diagnostics.addTrace({
          ruleId: this.id,
          outcome: 'blocked',
          message: `未知 productType：${_exhaustive}`,
        });
        return;
      }
    }

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `outcomeKind: ${decision.outcomeKind}, tags: ${decision.tags.length}`,
    });
  }
}
