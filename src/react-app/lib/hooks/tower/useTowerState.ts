import type {
  TowerSeasonMeta,
  TowerSettlement,
  TowerState,
} from '@shared/lib/tower';
import { useEffect, useState } from 'react';

export interface TowerStatePayload {
  season: TowerSeasonMeta;
  state: TowerState | null;
  eligible: boolean;
  minRealm: string;
  settlement?: TowerSettlement;
}

export function useTowerState(hasCultivator: boolean) {
  const [payload, setPayload] = useState<TowerStatePayload | null>(null);
  const [loading, setLoading] = useState(hasCultivator);

  useEffect(() => {
    if (!hasCultivator) {
      return;
    }

    let cancelled = false;

    const loadState = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tower/state');
        const data = (await response.json()) as TowerStatePayload & {
          error?: string;
        };

        if (cancelled) return;
        if (!response.ok || data.error) {
          throw new Error(data.error || '获取幻境状态失败');
        }

        setPayload(data);
      } catch {
        if (cancelled) return;
        setPayload(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [hasCultivator]);

  return {
    payload: hasCultivator ? payload : null,
    setPayload,
    loading: hasCultivator ? loading : false,
  };
}
