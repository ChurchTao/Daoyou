import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { SectTaskSettlementData } from '@daoyou/contracts/sect';

export interface SectCommandEffects {
  resourceChanges: ResourceChangeDescriptor[];
  settlement: SectTaskSettlementData;
}

export function emptySectCommandEffects(): SectCommandEffects {
  return {
    resourceChanges: [],
    settlement: { inventory: [] },
  };
}

export function mergeSectCommandEffects(
  ...effects: Array<SectCommandEffects | null | undefined>
): SectCommandEffects {
  const merged = emptySectCommandEffects();
  for (const effect of effects) {
    if (!effect) continue;
    merged.resourceChanges.push(...effect.resourceChanges);
    merged.settlement.inventory.push(...effect.settlement.inventory);
    if (effect.settlement.contribution !== undefined)
      merged.settlement.contribution = effect.settlement.contribution;
    if (effect.settlement.spiritStones !== undefined)
      merged.settlement.spiritStones = effect.settlement.spiritStones;
    if (effect.settlement.cultivationProgress !== undefined)
      merged.settlement.cultivationProgress =
        effect.settlement.cultivationProgress;
  }
  return merged;
}
