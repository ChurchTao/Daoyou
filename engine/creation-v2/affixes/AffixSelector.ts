import {
  AffixCandidate,
  AffixSelectionAudit,
  CreationIntent,
  EnergyBudget,
  RolledAffix,
} from '../types';

/**
 * 词缀抽签器
 * 在能量预算约束下，对候选词缀进行加权随机抽取
 * 同一 exclusiveGroup 只能命中一个词缀
 */
export class AffixSelector {
  select(
    pool: AffixCandidate[],
    budget: EnergyBudget,
    _intent: CreationIntent,
    maxCount = 4,
  ): AffixSelectionAudit {
    const result: RolledAffix[] = [];
    const pickedGroups = new Set<string>();
    const allocations: AffixSelectionAudit['allocations'] = [];
    const rejections: AffixSelectionAudit['rejections'] = [];
    let remaining = budget.remaining;
    let available = [...pool];
    let exhaustionReason: AffixSelectionAudit['exhaustionReason'];

    while (available.length > 0 && result.length < maxCount) {
      const budgetRejected = available.filter((c) => c.energyCost > remaining);
      const groupRejected = available.filter(
        (c) => c.exclusiveGroup && pickedGroups.has(c.exclusiveGroup),
      );

      const eligible = available.filter((c) => {
        if (c.energyCost > remaining) return false;
        if (c.exclusiveGroup && pickedGroups.has(c.exclusiveGroup)) return false;
        return true;
      });

      if (eligible.length === 0) {
        rejections.push(
          ...budgetRejected.map((candidate) => ({
            affixId: candidate.id,
            amount: candidate.energyCost,
            reason: 'budget_exhausted' as const,
            ...(candidate.exclusiveGroup
              ? { exclusiveGroup: candidate.exclusiveGroup }
              : {}),
          })),
          ...groupRejected.map((candidate) => ({
            affixId: candidate.id,
            amount: candidate.energyCost,
            reason: 'exclusive_group_conflict' as const,
            ...(candidate.exclusiveGroup
              ? { exclusiveGroup: candidate.exclusiveGroup }
              : {}),
          })),
        );
        exhaustionReason = budgetRejected.length > 0
          ? 'budget_exhausted'
          : groupRejected.length > 0
            ? 'exclusive_group_conflict'
            : 'pool_exhausted';
        break;
      }

      const totalWeight = eligible.reduce((s, c) => s + c.weight, 0);
      const chosen = this.weightedPick(eligible, totalWeight);

      result.push({ ...chosen, rollScore: chosen.weight / totalWeight });
      remaining -= chosen.energyCost;
      allocations.push({ affixId: chosen.id, amount: chosen.energyCost });

      if (chosen.exclusiveGroup) pickedGroups.add(chosen.exclusiveGroup);

      // 从候选池移除已抽中的词缀
      available = available.filter((c) => c.id !== chosen.id);
    }

    if (result.length >= maxCount) {
      exhaustionReason = 'max_count_reached';
    } else if (!exhaustionReason && available.length === 0) {
      exhaustionReason = 'pool_exhausted';
    }

    return {
      affixes: result,
      spent: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      remaining,
      allocations,
      rejections,
      exhaustionReason,
    };
  }

  private weightedPick(pool: AffixCandidate[], total: number): AffixCandidate {
    let rand = Math.random() * total;
    for (const c of pool) {
      rand -= c.weight;
      if (rand <= 0) return c;
    }
    return pool[pool.length - 1];
  }
}
