import { isPillConsumable } from '@shared/lib/consumables';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import { toPillDisplayModel } from './pillDisplayModel';

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

  return consumable.description;
}
