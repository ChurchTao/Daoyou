import type {
  Artifact,
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@/types/cultivator';

export type ItemDetailPayload =
  | {
      kind: 'artifact';
      item: Artifact;
    }
  | {
      kind: 'material';
      item: Material;
    }
  | {
      kind: 'consumable';
      item: Consumable;
    }
  | {
      kind: 'skill';
      item: Skill;
    }
  | {
      kind: 'gongfa';
      item: CultivationTechnique;
    };

export type InventoryDetailKind = 'artifact' | 'material' | 'consumable';

export function toInventoryItemDetail(
  kind: InventoryDetailKind,
  item: Artifact | Material | Consumable,
): ItemDetailPayload {
  if (kind === 'artifact') {
    return { kind, item: item as Artifact };
  }

  if (kind === 'material') {
    return { kind, item: item as Material };
  }

  return { kind, item: item as Consumable };
}
