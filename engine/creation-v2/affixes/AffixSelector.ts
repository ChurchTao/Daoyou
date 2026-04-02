import {
  AFFIX_STOP_REASONS,
  AffixCandidate,
  AffixSelectionAudit,
  CreationIntent,
  EnergyBudget,
  RolledAffix,
} from '../types';
import { AffixSelectionDecision, AffixSelectionFacts } from '../rules/contracts';
import { AffixSelectionRuleSet } from '../rules/affix/AffixSelectionRuleSet';
import { AffixPicker } from './AffixPicker';
import { CREATION_PROJECTION_BALANCE } from '../config/CreationBalance';

export interface AffixSelectionResult {
  audit: AffixSelectionAudit;
  lastDecision?: AffixSelectionDecision;
}

/**
 * 词缀抽签器
 * 在能量预算约束下，对候选词缀进行加权随机抽取
 * 同一 exclusiveGroup 只能命中一个词缀
 */
/*
 * AffixSelector: 在预算与互斥组约束下迭代选择词缀的策略实现。
 * 过程：
 *  - 使用 AffixSelectionRuleSet 得到候选池
 *  - 通过 AffixPicker 加权抽选
 *  - 记录审计（allocations / rejections / spent / remaining / exhaustionReason）供外部记录与回溯
 */
export class AffixSelector {
  constructor(
    private readonly ruleSet = new AffixSelectionRuleSet(),
    private readonly picker = new AffixPicker(),
  ) {}

  select(
    pool: AffixCandidate[],
    budget: EnergyBudget,
    intent: CreationIntent,
    maxCount: number = CREATION_PROJECTION_BALANCE.defaultMaxAffixCount,
  ): AffixSelectionAudit {
    return this.selectWithDecision(pool, budget, intent, maxCount).audit;
  }

  selectWithDecision(
    pool: AffixCandidate[],
    budget: EnergyBudget,
    intent: CreationIntent,
    maxCount: number = CREATION_PROJECTION_BALANCE.defaultMaxAffixCount,
  ): AffixSelectionResult {
    const result: RolledAffix[] = [];
    const pickedGroups = new Set<string>();
    const allocations: AffixSelectionAudit['allocations'] = [];
    const rejections: AffixSelectionAudit['rejections'] = [];
    let remaining = budget.remaining;
    let available = [...pool];
    const selectedAffixIds: string[] = [];
    let exhaustionReason: AffixSelectionAudit['exhaustionReason'];
    let lastDecision: AffixSelectionDecision | undefined;

    while (available.length > 0 && result.length < maxCount) {
      const facts: AffixSelectionFacts = {
        productType: intent.productType,
        candidates: available,
        remainingEnergy: remaining,
        sessionTags: intent.dominantTags,
        maxSelections: maxCount,
        selectionCount: result.length,
        selectedAffixIds,
        selectedExclusiveGroups: Array.from(pickedGroups),
      };
      const decision = this.ruleSet.evaluate(facts);
      lastDecision = decision;

      rejections.push(...decision.rejections);

      if (decision.candidatePool.length === 0) {
        exhaustionReason = decision.exhaustionReason;
        break;
      }

      const picked = this.picker.pick(decision.candidatePool);
      const chosen = picked.candidate;

      result.push({ ...chosen, rollScore: picked.rollScore });
      remaining -= chosen.energyCost;
      allocations.push({ affixId: chosen.id, amount: chosen.energyCost });
      selectedAffixIds.push(chosen.id);

      if (chosen.exclusiveGroup) pickedGroups.add(chosen.exclusiveGroup);

      available = available.filter((c) => c.id !== chosen.id);
    }

    if (result.length >= maxCount) {
      exhaustionReason = AFFIX_STOP_REASONS.MAX_COUNT_REACHED;
    } else if (!exhaustionReason && available.length === 0) {
      exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
    }

    const audit: AffixSelectionAudit = {
      affixes: result,
      spent: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      remaining,
      allocations,
      rejections,
      exhaustionReason,
    };

    return { audit, lastDecision };
  }
}
