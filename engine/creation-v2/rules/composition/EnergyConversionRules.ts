import {
  CREATION_PROJECTION_BALANCE,
  CREATION_SKILL_DEFAULTS,
} from '../../config/CreationBalance';
import { Rule } from '../core/Rule';
import { RuleContext } from '../core/RuleContext';
import { CompositionDecision } from '../contracts/CompositionDecision';
import { CompositionFacts } from '../contracts/CompositionFacts';

/**
 * EnergyConversionRules
 * 把能量预算换算为技能属性（mpCost、priority）并写入 decision.energyConversion。
 * 只与 active_skill 产物相关；passive 产物无需换算，此规则成为 no-op。
 * ProjectionRules 优先读取 decision.energyConversion，若不存在则使用自身默认值。
 */
export class EnergyConversionRules
  implements Rule<CompositionFacts, CompositionDecision>
{
  readonly id = 'composition.energy_conversion';

  apply({
    facts,
    decision,
    diagnostics,
  }: RuleContext<CompositionFacts, CompositionDecision>): void {
    if (facts.productType !== 'skill') return;

    const { energyBudget, affixes } = facts;
    const mpCost = Math.max(
      CREATION_SKILL_DEFAULTS.minMpCost,
      Math.round(energyBudget.total / CREATION_PROJECTION_BALANCE.mpCostDivisor),
    );
    const priority =
      CREATION_PROJECTION_BALANCE.skillPriorityBase + affixes.length;

    decision.energyConversion = { mpCost, priority };

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `能量换算：mpCost=${mpCost}, priority=${priority}`,
    });
  }
}
