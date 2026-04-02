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

  /**
   * 应用词缀选择审计结果更新预算。
   *
   * 适用场景：`rollAffixesWithDefaults`—`AffixSelector` 已产生完整的 `AffixSelectionAudit`，
   * 包含 allocations、rejections 和 exhaustionReason，直接映射到预算即可。
   *
   * 注意：调用此方法后如果后续再调用 `reconcileRolledAffixes`，
   * 必须确保后者能保留 rejections（否则価少信息会丢失）。
   */
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

  /**
   * 根据实际掉落的词缀百算实际花费。
   *
   * 适用场景：调用方自行提供 `RolledAffix[]`—不经过 `AffixSelector`—时
   * 能再算实际花费，并生成 allocations。
   *
   * 该方法保留现有 `rejections`：
   * 如果前面已通过 `applySelectionAudit` 设置了 rejections，重新调用此方法不会将其清空。
   */
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