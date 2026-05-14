import type { ElementType, MaterialType, Quality } from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface UsePaginatedInventoryMaterialsOptions {
  cultivatorId?: string;
  pageSize?: number;
  includeMaterialTypes?: MaterialType[];
  excludeMaterialTypes?: MaterialType[];
  materialRanks?: Quality[];
  materialElements?: ElementType[];
  materialSortBy?: 'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name';
  materialSortOrder?: 'asc' | 'desc';
}

interface InventoryMaterialsApiPayload {
  success: boolean;
  data?: {
    items?: Material[];
    pagination?: PaginationInfo;
  };
  error?: string;
}

const defaultPagination: PaginationInfo = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

// Dev StrictMode 下 mount/unmount/mount 会导致首次 useEffect 执行两次
// 用模块级 in-flight map 对同 URL 请求去重，避免重复网络请求
const inFlightMaterialsRequestMap = new Map<
  string,
  Promise<InventoryMaterialsApiPayload>
>();

async function fetchMaterialsWithDedupe(
  url: string,
): Promise<InventoryMaterialsApiPayload> {
  const inFlight = inFlightMaterialsRequestMap.get(url);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    const res = await fetch(url);
    const json = (await res.json()) as InventoryMaterialsApiPayload;
    if (!res.ok || !json.success) {
      throw new Error(json.error || '材料加载失败');
    }
    return json;
  })().finally(() => {
    inFlightMaterialsRequestMap.delete(url);
  });

  inFlightMaterialsRequestMap.set(url, requestPromise);
  return requestPromise;
}

export function usePaginatedInventoryMaterials(
  options: UsePaginatedInventoryMaterialsOptions,
) {
  const {
    cultivatorId,
    pageSize = 20,
    includeMaterialTypes = [],
    excludeMaterialTypes = [],
    materialRanks = [],
    materialElements = [],
    materialSortBy = 'createdAt',
    materialSortOrder = 'desc',
  } = options;

  const [materials, setMaterials] = useState<Material[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    ...defaultPagination,
    pageSize,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const requestIdRef = useRef(0);
  const fallbackPagination = useMemo(
    () => ({ ...defaultPagination, pageSize }),
    [pageSize],
  );

  const includeTypesKey = [...includeMaterialTypes].sort().join(',');
  const excludeTypesKey = [...excludeMaterialTypes].sort().join(',');
  const materialRanksKey = [...materialRanks].sort().join(',');
  const materialElementsKey = [...materialElements].sort().join(',');
  const filterKey = `${includeTypesKey}|${excludeTypesKey}|${materialRanksKey}|${materialElementsKey}|${materialSortBy}|${materialSortOrder}|${pageSize}`;

  const fetchPage = useCallback(
    async (targetPage: number, refresh = false) => {
      if (!cultivatorId) return;

      const requestId = ++requestIdRef.current;
      setError(undefined);
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          type: 'materials',
          page: String(Math.max(1, targetPage)),
          pageSize: String(pageSize),
        });

        if (includeTypesKey.length > 0) {
          params.set('materialTypes', includeTypesKey);
        }
        if (excludeTypesKey.length > 0) {
          params.set('excludeMaterialTypes', excludeTypesKey);
        }
        if (materialRanksKey.length > 0) {
          params.set('materialRanks', materialRanksKey);
        }
        if (materialElementsKey.length > 0) {
          params.set('materialElements', materialElementsKey);
        }
        params.set('materialSortBy', materialSortBy);
        params.set('materialSortOrder', materialSortOrder);

        const requestUrl = `/api/cultivator/inventory?${params.toString()}`;
        const json = await fetchMaterialsWithDedupe(requestUrl);

        if (requestId === requestIdRef.current) {
          setMaterials((json.data?.items || []) as Material[]);
          setPagination(
            (json.data?.pagination as PaginationInfo) || fallbackPagination,
          );
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : '材料加载失败');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsInitialized(true);
        }
      }
    },
    [
      cultivatorId,
      excludeTypesKey,
      fallbackPagination,
      includeTypesKey,
      materialElementsKey,
      materialRanksKey,
      materialSortBy,
      materialSortOrder,
      pageSize,
    ],
  );

  const refreshPage = useCallback(async () => {
    await fetchPage(pagination.page || 1, true);
  }, [fetchPage, pagination.page]);

  const goPrevPage = useCallback(async () => {
    if (isLoading || isRefreshing || pagination.page <= 1) return;
    await fetchPage(pagination.page - 1);
  }, [fetchPage, isLoading, isRefreshing, pagination.page]);

  const goNextPage = useCallback(async () => {
    if (
      isLoading ||
      isRefreshing ||
      pagination.totalPages <= 1 ||
      pagination.page >= pagination.totalPages
    ) {
      return;
    }
    await fetchPage(pagination.page + 1);
  }, [fetchPage, isLoading, isRefreshing, pagination.page, pagination.totalPages]);

  useEffect(() => {
    if (!cultivatorId) {
      return;
    }

    let cancelled = false;

    const loadInitialPage = async () => {
      try {
        const params = new URLSearchParams({
          type: 'materials',
          page: '1',
          pageSize: String(pageSize),
        });

        if (includeTypesKey.length > 0) {
          params.set('materialTypes', includeTypesKey);
        }
        if (excludeTypesKey.length > 0) {
          params.set('excludeMaterialTypes', excludeTypesKey);
        }
        if (materialRanksKey.length > 0) {
          params.set('materialRanks', materialRanksKey);
        }
        if (materialElementsKey.length > 0) {
          params.set('materialElements', materialElementsKey);
        }
        params.set('materialSortBy', materialSortBy);
        params.set('materialSortOrder', materialSortOrder);

        const requestUrl = `/api/cultivator/inventory?${params.toString()}`;
        const json = await fetchMaterialsWithDedupe(requestUrl);

        if (cancelled) return;

        setMaterials((json.data?.items || []) as Material[]);
        setPagination((json.data?.pagination as PaginationInfo) || fallbackPagination);
        setError(undefined);
        setIsInitialized(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '材料加载失败');
        setIsInitialized(true);
      }
    };

    void loadInitialPage();

    return () => {
      cancelled = true;
    };
  }, [
    cultivatorId,
    excludeTypesKey,
    fallbackPagination,
    filterKey,
    includeTypesKey,
    materialElementsKey,
    materialRanksKey,
    materialSortBy,
    materialSortOrder,
    pageSize,
  ]);

  return {
    materials: cultivatorId ? materials : [],
    pagination: cultivatorId ? pagination : fallbackPagination,
    isLoading: cultivatorId ? isLoading : false,
    isRefreshing: cultivatorId ? isRefreshing : false,
    isInitialized: cultivatorId ? isInitialized : false,
    error,
    refreshPage,
    goPrevPage,
    goNextPage,
  };
}
