import type {
  HerbGardenHarvestResult,
  HerbGardenState,
} from '@shared/contracts/herbGarden';
import { useCallback, useEffect, useState } from 'react';

interface GardenResponse {
  garden: HerbGardenState;
  message?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? `HTTP ${response.status}`);
  }
  return json;
}

export function useHerbGarden(ownerId?: string) {
  const [data, setData] = useState<HerbGardenState>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const endpoint = ownerId
    ? `/api/herb-garden/visit/${ownerId}`
    : '/api/herb-garden';

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await readJson<GardenResponse>(await fetch(endpoint));
      setData(result.garden);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '灵药圃读取失败');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [reload]);

  const mutate = useCallback(
    async <T extends { garden: HerbGardenState }>(url: string, body?: unknown) => {
      setBusy(true);
      setError(undefined);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const result = await readJson<T>(response);
        setData(result.garden);
        return result;
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : '药田事务失败';
        setError(message);
        throw reason;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const plant = useCallback(
    (slot: number, seedMaterialId: string) =>
      mutate<GardenResponse>('/api/herb-garden/plant', { slot, seedMaterialId }),
    [mutate],
  );

  const harvest = useCallback(
    (plotId: string) =>
      mutate<GardenResponse & { result: HerbGardenHarvestResult }>(
        `/api/herb-garden/plots/${plotId}/harvest`,
      ),
    [mutate],
  );

  const harvestAll = useCallback(
    () =>
      mutate<GardenResponse & { results: HerbGardenHarvestResult[] }>(
        '/api/herb-garden/harvest-all',
      ),
    [mutate],
  );

  const help = useCallback(
    (friendId: string, plotId: string) =>
      mutate<GardenResponse>(
        `/api/herb-garden/visit/${friendId}/plots/${plotId}/help`,
      ),
    [mutate],
  );

  const steal = useCallback(
    (friendId: string, plotId: string) =>
      mutate<GardenResponse & { result: { herbName: string; quantity: 1 } }>(
        `/api/herb-garden/visit/${friendId}/plots/${plotId}/steal`,
      ),
    [mutate],
  );

  return {
    data,
    loading,
    busy,
    error,
    reload,
    retry: reload,
    plant,
    harvest,
    harvestAll,
    help,
    steal,
  };
}
