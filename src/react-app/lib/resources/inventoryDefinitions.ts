import {
  reduceInventoryResourcePage,
  type ResourceTopic,
} from '@shared/contracts/resources';
import type {
  ElementType,
  MaterialType,
  Quality,
} from '@shared/types/constants';
import { loadResourceEndpoint, resolveTopicScope } from './definitionCore';
import type { ResourceDefinition } from './store';

export interface InventoryPageParams {
  page: number;
  pageSize: number;
  materialTypes?: MaterialType[];
  excludeMaterialTypes?: MaterialType[];
  materialRanks?: Quality[];
  materialElements?: ElementType[];
  materialSortBy?:
    'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name';
  materialSortOrder?: 'asc' | 'desc';
  consumableKind?: 'pill';
}

const normalizedStrings = <T extends string>(
  values: readonly T[] | undefined,
): T[] | undefined => {
  const normalized = Array.from(new Set(values ?? [])).sort();
  return normalized.length > 0 ? normalized : undefined;
};

export function normalizeInventoryPageParams(
  params: InventoryPageParams,
): InventoryPageParams {
  const materialTypes = normalizedStrings(params.materialTypes);
  const materialRanks = normalizedStrings(params.materialRanks);
  const materialElements = normalizedStrings(params.materialElements);
  const excludeMaterialTypes = normalizedStrings(params.excludeMaterialTypes);
  return {
    page: Math.max(1, Math.trunc(params.page)),
    pageSize: Math.min(100, Math.max(1, Math.trunc(params.pageSize))),
    ...(materialTypes ? { materialTypes } : {}),
    ...(excludeMaterialTypes ? { excludeMaterialTypes } : {}),
    ...(materialRanks ? { materialRanks } : {}),
    ...(materialElements ? { materialElements } : {}),
    ...(params.materialSortBy ? { materialSortBy: params.materialSortBy } : {}),
    ...(params.materialSortOrder
      ? { materialSortOrder: params.materialSortOrder }
      : {}),
    ...(params.consumableKind ? { consumableKind: params.consumableKind } : {}),
  };
}

type InventoryTopic =
  'inventory.artifacts' | 'inventory.materials' | 'inventory.consumables';

function inventoryPageResource<TTopic extends InventoryTopic>(
  topic: TTopic,
  tab: 'artifacts' | 'materials' | 'consumables',
): ResourceDefinition<TTopic, InventoryPageParams> {
  return {
    topic,
    resolveScope: (scopes) => resolveTopicScope(topic, scopes),
    normalizeParams: normalizeInventoryPageParams,
    load(scope, params, signal) {
      const query = new URLSearchParams({
        type: tab,
        page: String(params.page),
        pageSize: String(params.pageSize),
      });
      if (tab === 'materials') {
        setCsv(query, 'materialTypes', params.materialTypes);
        setCsv(query, 'excludeMaterialTypes', params.excludeMaterialTypes);
        setCsv(query, 'materialRanks', params.materialRanks);
        setCsv(query, 'materialElements', params.materialElements);
        if (params.materialSortBy) {
          query.set('materialSortBy', params.materialSortBy);
        }
        if (params.materialSortOrder) {
          query.set('materialSortOrder', params.materialSortOrder);
        }
      } else if (tab === 'consumables' && params.consumableKind) {
        query.set('consumableKind', params.consumableKind);
      }
      return loadResourceEndpoint(
        topic,
        `/api/cultivator/inventory?${query.toString()}`,
        scope,
        signal,
      );
    },
    reduce(current, change, params) {
      if (change.operation === 'invalidate') return { status: 'stale' };
      return reduceInventoryResourcePage(current, change, params);
    },
  };
}

export const inventoryArtifactsResource = inventoryPageResource(
  'inventory.artifacts',
  'artifacts',
);
export const inventoryMaterialsResource = inventoryPageResource(
  'inventory.materials',
  'materials',
);
export const inventoryConsumablesResource = inventoryPageResource(
  'inventory.consumables',
  'consumables',
);

function setCsv(
  query: URLSearchParams,
  name: string,
  values: readonly string[] | undefined,
): void {
  if (values?.length) query.set(name, values.join(','));
}

export type { ResourceTopic };
