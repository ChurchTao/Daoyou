import {
  AffixSelectionAudit,
  EnergyBudget,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '../types';

export class DefaultEnergyBudgeter {
  allocate(
    fingerprints: MaterialFingerprint[],
    recipeMatch?: RecipeMatch,
  ): EnergyBudget {
    const total = fingerprints.reduce(
      (sum, fingerprint) => sum + fingerprint.energyValue,
      0,
    );
    const reserved = recipeMatch?.reservedEnergy ?? 0;

    return {
      total,
      reserved,
      spent: 0,
      remaining: Math.max(0, total - reserved),
      initialRemaining: Math.max(0, total - reserved),
      allocations: [],
      rejections: [],
      sources: fingerprints.map((fingerprint) => ({
        source: fingerprint.materialName,
        amount: fingerprint.energyValue,
      })),
    };
  }

  applySelectionAudit(
    budget: EnergyBudget,
    selection: AffixSelectionAudit,
  ): EnergyBudget {
    return {
      ...budget,
      spent: selection.spent,
      remaining: selection.remaining,
      allocations: selection.allocations,
      rejections: selection.rejections,
      exhaustionReason: selection.exhaustionReason,
    };
  }

  reconcileRolledAffixes(
    budget: EnergyBudget,
    affixes: RolledAffix[],
  ): EnergyBudget {
    const spent = affixes.reduce((sum, affix) => sum + affix.energyCost, 0);

    return {
      ...budget,
      spent,
      remaining: Math.max(0, budget.total - budget.reserved - spent),
      allocations: affixes.map((affix) => ({
        affixId: affix.id,
        amount: affix.energyCost,
      })),
      rejections: budget.rejections ?? [],
    };
  }
}