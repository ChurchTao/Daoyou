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
/*
 * CompositionRuleSet: 组合/蓝图生成阶段的规则集合门面。
 * 执行链：OutcomeTagRules -> NamingRules -> EnergyConversionRules -> ProjectionRules -> FallbackOutcomeRules
 * 负责从 rolledAffixes 和 session facts 生成最终的 CompositionDecision（名称/描述/标签/投影策略等），
 * 由 Composer 将 Decision 投影为 CreationProductModel 与 AbilityConfig。
 */
/*
 * CompositionRuleSet: 组合校验规则集合门面。
 * 责任：对 Composer 输出的中间决定（composition facts）进行验证（冲突/上限/互斥），并输出 compositionDecision。
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
