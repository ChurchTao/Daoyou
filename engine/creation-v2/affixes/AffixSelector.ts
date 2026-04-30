import {
  AFFIX_STOP_REASONS,
  AffixCategory,
  AffixCandidate,
  AffixSelectionAudit,
  CreationIntent,
  EnergyBudget,
  RolledAffix,
} from '../types';
import { AffixSelectionDecision, AffixSelectionFacts } from '../rules/contracts';
import { AffixSelectionRuleSet } from '../rules/affix/AffixSelectionRuleSet';
import { AffixPicker } from './AffixPicker';
import { AffixRollEngine } from './AffixRollEngine';
import { CREATION_PROJECTION_BALANCE } from '../config/CreationBalance';
import { resolveAffixSelectionConstraints } from '../config/AffixSelectionConstraints';

export interface AffixSelectionResult {
  audit: AffixSelectionAudit;
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
 *  - 通过 AffixRollEngine 计算数值波动与 Perfect 标记
 *  - 记录审计（allocations / rejections / spent / remaining / exhaustionReason）供外部记录与回溯
 */
export class AffixSelector {
  constructor(
    private readonly ruleSet = new AffixSelectionRuleSet(),
    private readonly picker = new AffixPicker(),
    private readonly rollEngine = new AffixRollEngine(),
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
    const rounds: AffixSelectionAudit['rounds'] = [];
    let remaining = budget.remaining;
    let available = [...pool];
    const selectedAffixIds: string[] = [];
    const selectedCategoryCounts: Partial<Record<AffixCategory, number>> = {};
    const selectionConstraints = resolveAffixSelectionConstraints(
      intent.productType,
      maxCount,
      pool,
    );
    let exhaustionReason: AffixSelectionAudit['exhaustionReason'];
    let finalDecision: AffixSelectionDecision | undefined;
    let selectedSkillTargetConstraint: AffixCandidate['targetPolicyConstraint'];
    let selectedArtifactSlots: AffixCandidate['applicableArtifactSlots'];

    const runSelectionRound = (candidates: AffixCandidate[]): boolean => {
      const remainingBefore = remaining;
      const facts: AffixSelectionFacts = {
        productType: intent.productType,
        candidates,
        remainingEnergy: remaining,
        inputTags: intent.dominantTags,
        maxSelections: maxCount,
        selectionCount: result.length,
        selectedAffixIds,
        selectedExclusiveGroups: Array.from(pickedGroups),
        selectedCategoryCounts,
        selectionConstraints,
      };
      const decision = this.ruleSet.evaluate(facts);
      finalDecision = decision;

      this.mergeUniqueRejections(rejections, decision.rejections);

      if (decision.candidatePool.length === 0) {
        exhaustionReason = decision.exhaustionReason;
        rounds.push({
          round: rounds.length + 1,
          remainingBefore,
          remainingAfter: remainingBefore,
          inputCandidates: [...candidates],
          decision,
        });
        return false;
      }

      const picked = this.picker.pick(decision.candidatePool);
      
      // === 核心注入点：使用 RollEngine 为词缀注入数值灵魂 ===
      const chosen = this.rollEngine.roll(
        picked.candidate,
        budget,
        picked.rollScore,
      );

      result.push(chosen);
      remaining -= chosen.energyCost;
      allocations.push({ affixId: chosen.id, amount: chosen.energyCost });
      selectedAffixIds.push(chosen.id);
      selectedCategoryCounts[chosen.category] =
        (selectedCategoryCounts[chosen.category] ?? 0) + 1;

      if (
        intent.productType === 'skill' &&
        chosen.category === 'skill_core'
      ) {
        selectedSkillTargetConstraint = chosen.targetPolicyConstraint;
      }

      if (
        intent.productType === 'artifact' &&
        chosen.category === 'artifact_core'
      ) {
        selectedArtifactSlots = chosen.applicableArtifactSlots;
      }

      if (chosen.exclusiveGroup) pickedGroups.add(chosen.exclusiveGroup);

      rounds.push({
        round: rounds.length + 1,
        remainingBefore,
        remainingAfter: remaining,
        inputCandidates: [...candidates],
        decision,
        pickedAffix: chosen,
      });

      available = available.filter((c) => c.id !== chosen.id);
      return true;
    };

    // Stage A: core first — 保证主机制先落位。
    let coreSelected = false;

    if (maxCount > 0) {
      const coreCandidates = available.filter((candidate) => ['skill_core', 'gongfa_foundation', 'artifact_core'].includes(candidate.category));
      if (coreCandidates.length > 0) {
        coreSelected = runSelectionRound(coreCandidates);
      } else {
        exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
      }
    }

    while (coreSelected && available.length > 0 && result.length < maxCount) {
      const nonCoreCandidates = available.filter((candidate) => {
        if (['skill_core', 'gongfa_foundation', 'artifact_core'].includes(candidate.category)) {
          return false;
        }

        if (
          intent.productType === 'skill' &&
          !this.isSkillTargetPolicyCompatible(
            selectedSkillTargetConstraint,
            candidate.targetPolicyConstraint,
          )
        ) {
          return false;
        }

        if (
          intent.productType === 'artifact' &&
          !this.isArtifactSlotCompatible(
            selectedArtifactSlots,
            candidate.applicableArtifactSlots,
          )
        ) {
          return false;
        }

        return true;
      });
      if (nonCoreCandidates.length === 0) {
        exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
        break;
      }

      const picked = runSelectionRound(nonCoreCandidates);
      if (!picked) {
        break;
      }
    }

    if (result.length >= maxCount) {
      exhaustionReason = AFFIX_STOP_REASONS.MAX_COUNT_REACHED;
    } else if (!exhaustionReason && available.length === 0) {
      exhaustionReason = AFFIX_STOP_REASONS.POOL_EXHAUSTED;
    }

    const audit: AffixSelectionAudit = {
      rounds,
      affixes: result,
      spent: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      remaining,
      allocations,
      rejections,
      exhaustionReason,
      ...(finalDecision ? { finalDecision } : {}),
    };

    return { audit };
  }

  private mergeUniqueRejections(
    target: AffixSelectionAudit['rejections'],
    incoming: AffixSelectionAudit['rejections'],
  ): void {
    const existing = new Set(
      target.map((rejection) => this.buildRejectionKey(rejection)),
    );

    for (const rejection of incoming) {
      const key = this.buildRejectionKey(rejection);
      if (existing.has(key)) {
        continue;
      }

      target.push(rejection);
      existing.add(key);
    }
  }

  private buildRejectionKey(rejection: AffixSelectionAudit['rejections'][number]): string {
    return [
      rejection.affixId,
      rejection.reason,
      rejection.exclusiveGroup ?? '',
      String(rejection.amount),
    ].join('||');
  }

  private isSkillTargetPolicyCompatible(
    coreConstraint?: AffixCandidate['targetPolicyConstraint'],
    candidateConstraint?: AffixCandidate['targetPolicyConstraint'],
  ): boolean {
    if (!coreConstraint || !candidateConstraint) {
      return true;
    }

    if (
      coreConstraint.team &&
      candidateConstraint.team &&
      coreConstraint.team !== candidateConstraint.team
    ) {
      return false;
    }

    if (
      coreConstraint.scope &&
      candidateConstraint.scope &&
      coreConstraint.scope !== candidateConstraint.scope
    ) {
      return false;
    }

    return true;
  }

  private isArtifactSlotCompatible(
    coreSlots?: AffixCandidate['applicableArtifactSlots'],
    candidateSlots?: AffixCandidate['applicableArtifactSlots'],
  ): boolean {
    if (!coreSlots || coreSlots.length === 0 || !candidateSlots || candidateSlots.length === 0) {
      return true;
    }

    return coreSlots.some((slot) => candidateSlots.includes(slot));
  }

}
