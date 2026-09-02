import {
  inventoryArtifactsResource,
  inventoryConsumablesResource,
  inventoryMaterialsResource,
  type InventoryPageParams,
} from '@app/lib/resources/definitions';
import { useResource } from '@app/lib/resources/hooks';
import { useCallback, useMemo, useState, type SetStateAction } from 'react';

type MaterialInventoryOptions = Omit<InventoryPageParams, 'page'> & {
  enabled?: boolean;
};

export function useMaterialInventoryResource(
  options: MaterialInventoryOptions,
) {
  const { enabled = true, ...filters } = options;
  const filterKey = JSON.stringify(filters);
  const [paginationState, setPaginationState] = useState({
    filterKey,
    page: 1,
  });
  const page =
    paginationState.filterKey === filterKey ? paginationState.page : 1;
  const setPage = useCallback(
    (next: SetStateAction<number>) => {
      setPaginationState((current) => {
        const currentPage = current.filterKey === filterKey ? current.page : 1;
        return {
          filterKey,
          page: typeof next === 'function' ? next(currentPage) : next,
        };
      });
    },
    [filterKey],
  );
  const normalizedFilters = useMemo(
    () => JSON.parse(filterKey) as Omit<InventoryPageParams, 'page'>,
    [filterKey],
  );
  const params = useMemo(
    () => ({ ...normalizedFilters, page }) satisfies InventoryPageParams,
    [normalizedFilters, page],
  );
  const query = useResource(inventoryMaterialsResource, params, enabled);
  return {
    ...query,
    items: query.data?.items,
    pagination: query.data?.pagination,
    page,
    setPage,
    goPrevPage: () => {
      setPage((current) => Math.max(1, current - 1));
    },
    goNextPage: () => {
      setPage((current) => current + 1);
    },
  };
}

export function useArtifactInventoryResource(options: {
  pageSize: number;
  enabled?: boolean;
}) {
  const { pageSize, enabled = true } = options;
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const query = useResource(inventoryArtifactsResource, params, enabled);
  return {
    ...query,
    items: query.data?.items,
    pagination: query.data?.pagination,
    page,
    setPage,
    goPrevPage: () => {
      setPage((current) => Math.max(1, current - 1));
    },
    goNextPage: () => {
      setPage((current) => current + 1);
    },
  };
}

export function useConsumableInventoryResource(options: {
  pageSize: number;
  enabled?: boolean;
  consumableKind?: 'pill' | 'spirit_fruit' | 'tradable';
}) {
  const { pageSize, enabled = true, consumableKind } = options;
  const [page, setPage] = useState(1);
  const params = useMemo(
    () => ({ page, pageSize, consumableKind }),
    [consumableKind, page, pageSize],
  );
  const query = useResource(inventoryConsumablesResource, params, enabled);
  return {
    ...query,
    items: query.data?.items,
    pagination: query.data?.pagination,
    page,
    setPage,
    goPrevPage: () => {
      setPage((current) => Math.max(1, current - 1));
    },
    goNextPage: () => {
      setPage((current) => current + 1);
    },
  };
}
