import { combatV6Request } from '@app/components/feature/combat-v6/request';
import type { InventoryKind } from '@app/components/feature/items/InventoryFilters';
import { usePlayerSession } from '@app/lib/resources/player';
import type { InventoryView } from '@shared/contracts/inventory';
import { useCallback, useEffect, useState } from 'react';

export function useCraftStorage(kind: InventoryKind, enabled: boolean) {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState<InventoryView>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled || !owner) return;
    setView(undefined);
    setError('');
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
        setView(data);
        setPage(data.page);
        setError('');
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : '读取储藏室失败');
        }
      });
    return () => controller.abort();
  }, [enabled, kind, owner, page, refresh, search]);
  const reload = useCallback(() => {
    setView(undefined);
    setError('');
    setRefresh((value) => value + 1);
  }, []);
  return {
    view,
    error,
    loading: !view && !error,
    page,
    search,
    setPage(value: number) {
      setView(undefined);
      setError('');
      setPage(value);
    },
    setSearch(value: string) {
      setView(undefined);
      setError('');
      setSearch(value);
      setPage(0);
    },
    reload,
  };
}
