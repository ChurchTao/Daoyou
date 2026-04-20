import {
  AffixSelectionAudit,
  EnergyBudget,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '../types';
import { buildMaterialEnergyProfile } from '../analysis/MaterialBalanceProfile';

export class DefaultEnergyBudgeter {
  allocate(
    fingerprints: MaterialFingerprint[],
    recipeMatch?: RecipeMatch,
  ): EnergyBudget {
    const energyProfile = buildMaterialEnergyProfile(fingerprints);
    const reserved = recipeMatch?.reservedEnergy ?? 0;

    const sources = fingerprints.map((fingerprint) => ({
      source: fingerprint.materialName,
      amount: fingerprint.energyValue,
    }));
    if (energyProfile.diversityBonus > 0) {
      sources.push({
        source: 'bonus:diversity',
        amount: energyProfile.diversityBonus,
      });
    }
    if (energyProfile.coherenceBonus > 0) {
      sources.push({
        source: 'bonus:coherence',
        amount: energyProfile.coherenceBonus,
      });
    }

    return {
      baseTotal: energyProfile.baseEnergy,
      effectiveTotal: energyProfile.effectiveEnergy,
      reserved,
      spent: 0,
      remaining: Math.max(0, energyProfile.effectiveEnergy - reserved),
      initialRemaining: Math.max(0, energyProfile.effectiveEnergy - reserved),
      allocations: [],
      rejections: [],
      sources,
    };
  }

  finalizeSelection(
    budget: EnergyBudget,
    selection: AffixSelectionAudit,
  ): EnergyBudget {
    const next: EnergyBudget = {
      ...budget,
      spent: selection.spent,
      remaining: selection.remaining,
      allocations: selection.allocations,
      rejections: selection.rejections,
      exhaustionReason: selection.exhaustionReason,
    };

    this.assertClosedLoop(next);
    return next;
  }

  /**
   * 根据显式提供的词缀列表结算预算。
   *
   * 适用场景：调用方绕过 `AffixSelector`，直接提供 `RolledAffix[]` 时
   * 仍可按最终掉落结果构造可守恒的预算账本。
   */
  reconcileRolledAffixes(
    budget: EnergyBudget,
    affixes: RolledAffix[],
  ): EnergyBudget {
    const spent = affixes.reduce((sum, affix) => sum + affix.energyCost, 0);

    const next: EnergyBudget = {
      ...budget,
      spent,
      remaining: Math.max(0, budget.effectiveTotal - budget.reserved - spent),
      allocations: affixes.map((affix) => ({
        affixId: affix.id,
        amount: affix.energyCost,
      })),
      rejections: budget.rejections ?? [],
    };

    this.assertClosedLoop(next);
    return next;
  }

  private assertClosedLoop(budget: EnergyBudget): void {
    const availableAffixEnergy = Math.max(0, budget.effectiveTotal - budget.reserved);
    if (budget.spent + budget.remaining !== availableAffixEnergy) {
      throw new Error(
        `Energy budget ledger mismatch: available=${availableAffixEnergy}, spent=${budget.spent}, remaining=${budget.remaining}`,
      );
    }
  }
}