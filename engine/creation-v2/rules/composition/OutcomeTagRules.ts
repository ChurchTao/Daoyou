import { CORE_EFFECT_TYPE_TO_ABILITY_TAG, ELEMENT_TO_ABILITY_TAG } from '../../config/CreationMappings';
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
    const elementTag = intent.elementBias
      ? ELEMENT_TO_ABILITY_TAG[intent.elementBias]
      : undefined;

    switch (productType) {
      case 'skill': {
        // facts.coreEffectType is populated by buildCompositionFacts when a registry is available.
        // Falls back to 'damage' when absent (e.g. unit tests building CompositionFacts directly).
        const abilityTypeTag =
          CORE_EFFECT_TYPE_TO_ABILITY_TAG[facts.coreEffectType ?? 'damage'] ??
          CreationTags.BATTLE.ABILITY_TYPE_DAMAGE;
        decision.outcomeKind = facts.outcomeKind;
        decision.tags = [
          CreationTags.OUTCOME.ACTIVE_SKILL,
          abilityTypeTag,
          ...(elementTag ? [elementTag] : []),
          ...intent.dominantTags,
        ];
        break;
      }
      case 'artifact':
        decision.outcomeKind = facts.outcomeKind;
        decision.tags = [
          CreationTags.OUTCOME.PASSIVE_ABILITY,
          CreationTags.OUTCOME.ARTIFACT,
          ...(elementTag ? [elementTag] : []),
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
