'use client';

import type { Artifact } from '@/types/cultivator';
import { useCallback, useEffect, useRef, useState } from 'react';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface UsePaginatedInventoryArtifactsOptions {
  cultivatorId?: string;
  pageSize?: number;
}

interface InventoryArtifactsApiPayload {
  success: boolean;
  data?: {
    items?: Artifact[];
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

const inFlightArtifactsRequestMap = new Map<
  string,
  Promise<InventoryArtifactsApiPayload>
>();

async function fetchArtifactsWithDedupe(
  url: string,
): Promise<InventoryArtifactsApiPayload> {
  const inFlight = inFlightArtifactsRequestMap.get(url);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    const res = await fetch(url);
    const json = (await res.json()) as InventoryArtifactsApiPayload;
    if (!res.ok || !json.success) {
      throw new Error(json.error || '法宝加载失败');
    }
    return json;
  })().finally(() => {
    inFlightArtifactsRequestMap.delete(url);
  });

  inFlightArtifactsRequestMap.set(url, requestPromise);
  return requestPromise;
}

export function usePaginatedInventoryArtifacts(
  options: UsePaginatedInventoryArtifactsOptions,
) {
  const { cultivatorId, pageSize = 20 } = options;

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    ...defaultPagination,
    pageSize,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const requestIdRef = useRef(0);

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
          type: 'artifacts',
          page: String(Math.max(1, targetPage)),
          pageSize: String(pageSize),
        });

        const requestUrl = `/api/cultivator/inventory?${params.toString()}`;
        const json = await fetchArtifactsWithDedupe(requestUrl);

        if (requestId !== requestIdRef.current) return;

        setArtifacts((json.data?.items || []) as Artifact[]);
        setPagination(
          (json.data?.pagination as PaginationInfo) || {
            ...defaultPagination,
            pageSize,
          },
        );
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : '法宝加载失败');
      } finally {
        if (requestId !== requestIdRef.current) return;
        setIsLoading(false);
        setIsRefreshing(false);
        setIsInitialized(true);
      }
    },
    [cultivatorId, pageSize],
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
      setArtifacts([]);
      setPagination({ ...defaultPagination, pageSize });
      setError(undefined);
      setIsInitialized(false);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    void fetchPage(1);
  }, [cultivatorId, fetchPage, pageSize]);

  return {
    artifacts,
    pagination,
    isLoading,
    isRefreshing,
    isInitialized,
    error,
    refreshPage,
    goPrevPage,
    goNextPage,
  };
}
