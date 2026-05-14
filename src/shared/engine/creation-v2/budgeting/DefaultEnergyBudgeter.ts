import {
  CreationProductType,
  AffixSelectionAudit,
  EnergyBudget,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '../types';
import { buildMaterialEnergyProfile } from '../analysis/MaterialBalanceProfile';
import { CREATION_MANUAL_ALIGNMENT } from '../config/CreationBalance';
import { hasMissingMatchingManualForProduct } from '../config/CreationCraftPolicy';

export class DefaultEnergyBudgeter {
  allocate(
    fingerprints: MaterialFingerprint[],
    recipeMatch?: RecipeMatch,
    productType?: CreationProductType,
  ): EnergyBudget {
    const energyProfile = buildMaterialEnergyProfile(fingerprints);
    const reserved = recipeMatch?.reservedEnergy ?? 0;
    const missingManualPenalty = this.resolveMissingManualPenalty(
      productType,
      fingerprints,
    );
    const effectiveTotal = Math.max(
      0,
      energyProfile.effectiveEnergy - missingManualPenalty,
    );

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
    if (missingManualPenalty > 0) {
      sources.push({
        source: 'penalty:missing_matching_manual',
        amount: -missingManualPenalty,
      });
    }

    return {
      baseTotal: energyProfile.baseEnergy,
      effectiveTotal,
      reserved,
      spent: 0,
      remaining: Math.max(0, effectiveTotal - reserved),
      initialRemaining: Math.max(0, effectiveTotal - reserved),
      allocations: [],
      rejections: [],
      sources,
    };
  }

  private resolveMissingManualPenalty(
    productType: CreationProductType | undefined,
    fingerprints: MaterialFingerprint[],
  ): number {
    if (!productType) {
      return 0;
    }

    if (
      !hasMissingMatchingManualForProduct(
        productType,
        fingerprints.map((fingerprint) => fingerprint.materialType),
      )
    ) {
      return 0;
    }

    return (
      CREATION_MANUAL_ALIGNMENT.missingManualPenaltyByProduct[productType] ?? 0
    );
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