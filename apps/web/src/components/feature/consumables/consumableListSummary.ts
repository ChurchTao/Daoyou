import {
  isPillConsumable,
  isSpiritFruitConsumable,
} from '@daoyou/game-domain/consumables';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { RealmType } from '@daoyou/constants/realms';
import type { Consumable } from '@daoyou/game-domain/character';
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
