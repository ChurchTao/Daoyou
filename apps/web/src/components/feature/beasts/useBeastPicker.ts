import { combatV6Request } from '@app/components/feature/combat-v6/request';
import {
  type BeastPickerLocation,
  type BeastPickerPage,
} from '@daoyou/contracts/beasts';
import { useEffect, useState } from 'react';

export function useBeastPicker({
  active = true,
  location = 'all',
  initialBeastId,
}: {
  active?: boolean;
  location?: BeastPickerLocation;
  initialBeastId?: string;
} = {}) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [focusId, setFocusId] = useState(initialBeastId);
  const [data, setData] = useState<BeastPickerPage>();
  const [settled, setSettled] = useState<{ key: string; error: string }>();
  const key = active
    ? `${location}:${page}:${refresh}:${focusId ?? ''}`
    : '';
  const loading = !!key && settled?.key !== key;
  const error = settled?.key === key ? settled.error : '';
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const requestKey = key;
    const params = new URLSearchParams({
      page: String(page),
      location,
    });
    if (focusId) params.set('beast', focusId);
    void combatV6Request<BeastPickerPage>(
      `/api/combat-v6/beasts/picker?${params}`,
      { signal: controller.signal },
    )
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setSettled({ key: requestKey, error: '' });
        setFocusId(undefined);
        setPage((current) => (current === next.page ? current : next.page));
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setSettled({
          key: requestKey,
          error: reason instanceof Error ? reason.message : '灵兽读取失败',
        });
      });
    return () => controller.abort();
  }, [focusId, key, location, page]);
  return {
    page,
    setPage: (next: number) => {
      setFocusId(undefined);
      setPage(next);
    },
    data,
    error,
    loading,
    reload: () => setRefresh((value) => value + 1),
    focus: (beastId: string) => {
      setFocusId(beastId);
      setRefresh((value) => value + 1);
    },
  };
}
