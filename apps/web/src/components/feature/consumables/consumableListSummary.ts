import {
  isPillConsumable,
  isSpiritFruitConsumable,
} from '@daoyou/shared/lib/consumables';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import type { RealmType } from '@daoyou/shared/types/constants';
import type { Consumable } from '@daoyou/shared/types/cultivator';
import {
  toPillDisplayModel,
  toSpiritFruitDisplayModel,
} from './pillDisplayModel';

export function getConsumableListSummary(
  consumable: Consumable,
  options?: {
    realm?: RealmType;
    condition?: CultivatorCondition;
  },
): string | undefined {
  if (isPillConsumable(consumable)) {
    return toPillDisplayModel(consumable, options).effectSummary;
  }
  if (isSpiritFruitConsumable(consumable)) {
    return toSpiritFruitDisplayModel(consumable, options).effectSummary;
  }

  return consumable.description;
}
