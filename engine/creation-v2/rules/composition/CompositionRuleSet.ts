import { AffixEffectTranslator } from '../../affixes/AffixEffectTranslator';
import { AffixRegistry } from '../../affixes/AffixRegistry';
import { RuleSet } from '../core/RuleSet';
import { CompositionDecision } from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';
import { EnergyConversionRules } from './EnergyConversionRules';
import { FallbackOutcomeRules } from './FallbackOutcomeRules';
import { NamingRules } from './NamingRules';
import { OutcomeTagRules } from './OutcomeTagRules';
import { ProjectionRules } from './ProjectionRules';

/**
 * CompositionRuleSet
 * 执行顺序：OutcomeTagRules → NamingRules → EnergyConversionRules → ProjectionRules → FallbackOutcomeRules
 *
 * EnergyConversionRules 在 ProjectionRules 之前运行，填充 decision.energyConversion
 * ProjectionRules 优先读取该值，使换算策略可被替换
 */
export class CompositionRuleSet {
  private readonly ruleSet: RuleSet<CompositionFacts, CompositionDecision>;

  constructor(
    registry: AffixRegistry,
    translator: AffixEffectTranslator = new AffixEffectTranslator(),
  ) {
    this.ruleSet = new RuleSet<CompositionFacts, CompositionDecision>(
      [
        new OutcomeTagRules(),
        new NamingRules(),
        new EnergyConversionRules(),
        new ProjectionRules(registry, translator),
        new FallbackOutcomeRules(),
      ],
      (facts) => ({
        outcomeKind: facts.outcomeKind,
        name: '',
        description: undefined,
        tags: [],
        affixes: facts.affixes,
        defaultsApplied: [],
        reasons: [],
        warnings: [],
        trace: [],
      }),
    );
  }

  evaluate(facts: CompositionFacts): CompositionDecision {
    return this.ruleSet.evaluate(facts);
  }
}
