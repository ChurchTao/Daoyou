import type { CreateItemLibraryEntry } from '@daoyou/contracts/items/library';
import type { ItemLibraryEntry } from '@daoyou/game-domain/items/catalog';
import type { ElementType } from '@daoyou/constants/elements';
import type { MaterialType } from '@daoyou/game-domain/inventory';
import type { Quality } from '@daoyou/constants/qualities';

export interface ItemLibraryDraft {
  rowId: string;
  itemId: string;
  type: 'material';
  status: 'published' | 'archived';
  name: string;
  description: string;
  materialType: MaterialType;
  materialRank: Quality;
  materialElement: '' | ElementType;
  materialDetails: Record<string, unknown>;
}
export function createEmptyDraft(): ItemLibraryDraft {
  return {
    rowId: '',
    itemId: '',
    type: 'material',
    status: 'published',
    name: '',
    description: '',
    materialType: 'herb',
    materialRank: '凡品',
    materialElement: '',
    materialDetails: {},
  };
}
export function entryToDraft(entry: ItemLibraryEntry): ItemLibraryDraft {
  if (entry.type !== 'material') throw new Error('仅支持材料');
  return {
    rowId: entry.id,
    itemId: entry.itemId,
    type: 'material',
    status: entry.status,
    name: entry.payload.name,
    description: entry.payload.description ?? '',
    materialType: entry.payload.type,
    materialRank: entry.payload.rank,
    materialElement: entry.payload.element ?? '',
    materialDetails: entry.payload.details ?? {},
  };
}
export function buildItemLibrarySubmitBody(
  draft: ItemLibraryDraft,
): CreateItemLibraryEntry {
  return {
    itemId: draft.itemId.trim(),
    type: 'material',
    status: draft.status,
    payload: {
      name: draft.name.trim(),
      type: draft.materialType,
      rank: draft.materialRank,
      ...(draft.materialElement ? { element: draft.materialElement } : {}),
      description: draft.description.trim(),
      details: draft.materialDetails,
    },
    editorConfig: {},
  };
}
