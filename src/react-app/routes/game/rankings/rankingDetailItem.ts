import type { ItemDetailPayload } from '@app/routes/game/inventory/components/itemDetailPayload';
import { assertConsumableSpec } from '@shared/lib/consumables';
import type {
  Artifact,
  Consumable,
  CultivationTechnique,
  Skill,
} from '@shared/types/cultivator';
import type { ItemRankingEntry } from '@shared/types/rankings';

export function toRankingDetailItem(item: ItemRankingEntry): ItemDetailPayload {
  if (item.itemType === 'artifact') {
    const artifact: Artifact = {
      id: item.id,
      name: item.name,
      slot: (item.slot as Artifact['slot']) || 'weapon',
      element: (item.element as Artifact['element']) || '金',
      quality: item.quality as Artifact['quality'],
      description: item.description,
      score: item.score,
      abilityConfig: item.abilityConfig as Artifact['abilityConfig'],
      productModel: item.productModel,
    };

    return { kind: 'artifact', item: artifact };
  }

  if (item.itemType === 'skill') {
    const skill: Skill = {
      id: item.id,
      name: item.name,
      element: (item.element as Skill['element']) || '金',
      quality: item.quality as Skill['quality'],
      cost: item.cost || 0,
      cooldown: item.cooldown || 0,
      description: item.description,
      abilityConfig: item.abilityConfig as Skill['abilityConfig'],
      productModel: item.productModel,
    };

    return { kind: 'skill', item: skill };
  }

  if (item.itemType === 'technique') {
    const technique: CultivationTechnique = {
      id: item.id,
      name: item.name,
      element: item.element as CultivationTechnique['element'],
      quality: item.quality as CultivationTechnique['quality'],
      description: item.description,
      abilityConfig: item.abilityConfig as CultivationTechnique['abilityConfig'],
      productModel: item.productModel,
    };

    return { kind: 'gongfa', item: technique };
  }

  const consumable: Consumable = {
    id: item.id,
    name: item.name,
    type: (item.type as Consumable['type']) || '丹药',
    quality: item.quality as Consumable['quality'],
    quantity: item.quantity || 1,
    description: item.description,
    score: item.score,
    spec: assertConsumableSpec(item.spec),
  };

  return { kind: 'consumable', item: consumable };
}
