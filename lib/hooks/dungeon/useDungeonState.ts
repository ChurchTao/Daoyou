import { DungeonState } from '@/lib/dungeon/types';
import { useEffect, useState } from 'react';

/**
 * 副本状态管理Hook
 * 负责获取和管理副本状态
 */
export function useDungeonState(hasCultivator: boolean) {
  const [state, setState] = useState<DungeonState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = async () => {
    if (!hasCultivator) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dungeon/state');
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setState(data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取副本状态失败');
      setState(null);
    } finally {
      setLoading(false);
    }
  };

  // 自动加载状态
  useEffect(() => {
    fetchState();
  }, [hasCultivator]);

  const refresh = () => {
    fetchState();
  };

  return {
    state,
    setState,
    loading,
    error,
    refresh,
  };
}
