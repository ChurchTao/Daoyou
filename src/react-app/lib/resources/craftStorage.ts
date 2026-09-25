import { combatV6Request } from '@app/components/feature/combat-v6/request';
import type { InventoryKind } from '@app/components/feature/items/inventoryFilterModel';
import { usePlayerSession } from '@app/lib/resources/player';
import type { InventoryView } from '@shared/contracts/inventory';
import { useCallback, useEffect, useState } from 'react';

export function useCraftStorage(kind: InventoryKind, enabled: boolean) {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; view: InventoryView }>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const key = `${owner}:${kind}:${page}:${search}`;
  const view = result?.key === key ? result.view : undefined;
  const error = failure?.key === key ? failure.message : '';
  useEffect(() => {
    if (!enabled || !owner) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      location: 'storage',
      kind,
      page: String(page),
      search,
    });
    void combatV6Request<InventoryView>(`/api/combat-v6/inventory?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({ key, view: data });
        setPage(data.page);
        setFailure(undefined);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setFailure({
            key,
            message: cause instanceof Error ? cause.message : '读取储藏室失败',
          });
        }
      });
    return () => controller.abort();
  }, [enabled, kind, owner, page, refresh, search, key]);
  const reload = useCallback(() => {
    setResult(undefined);
    setFailure(undefined);
    setRefresh((value) => value + 1);
  }, []);
  return {
    view,
    error,
    loading: !view && !error,
    page,
    search,
    setPage(value: number) {
      setResult(undefined);
      setFailure(undefined);
      setPage(value);
    },
    setSearch(value: string) {
      setResult(undefined);
      setFailure(undefined);
      setSearch(value);
      setPage(0);
    },
    reload,
  };
}
