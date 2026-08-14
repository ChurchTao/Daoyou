import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import { resolveAlchemyEffects } from '@shared/lib/alchemyEffectResolver';
import type {
  AlchemyEffectRoute,
  AlchemyYieldProfile,
  PillSpec,
} from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';

export interface AlchemyOutputDraft {
  name: string;
  type: '丹药';
  description?: string;
  prompt?: string;
  spec: Omit<PillSpec, 'operations'>;
  route: AlchemyEffectRoute;
  fitMultiplier: number;
}

/** 在最终 lot 的品质与品相确定后，唯一一次解析并组装可入库丹药。 */
export function assembleAlchemyOutputConsumables(
  draft: AlchemyOutputDraft,
  yieldProfile: AlchemyYieldProfile,
): Consumable[] {
  return yieldProfile.lots.map((lot) => {
    const spec: PillSpec = {
      ...draft.spec,
      operations: resolveAlchemyEffects({
        route: draft.route,
        quality: lot.quality,
        appearance: lot.appearance,
        fitMultiplier: draft.fitMultiplier,
      }).operations,
      alchemyMeta: {
        ...draft.spec.alchemyMeta,
        version: 4,
        appearance: lot.appearance,
        batch: draft.spec.alchemyMeta.batch
          ? {
              ...(() => {
                const persisted = { ...draft.spec.alchemyMeta.batch };
                delete persisted.essenceSummary;
                delete persisted.yieldProfile;
                return persisted;
              })(),
              lotQuantity: lot.quantity,
              essenceLossRatio: yieldProfile.essenceLossRatio,
            }
          : undefined,
      },
    };
    const consumable: Consumable = {
      name: draft.name,
      type: draft.type,
      description: draft.description,
      prompt: draft.prompt,
      quality: lot.quality,
      quantity: lot.quantity,
      spec,
    };
    consumable.score = calculateSingleElixirScore(consumable);
    return consumable;
  });
}
