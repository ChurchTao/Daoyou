import { useEffect, useState } from 'react';

/**
 * 副本每日次数限制信息
 */
export interface DungeonLimitInfo {
  allowed: boolean;
  remaining: number;
  used: number;
  dailyLimit: number;
}

/**
 * 副本次数限制 Hook
 *
 * 职责：
 * 1. 获取用户当日剩余的副本探索次数
 * 2. 提供加载状态和错误处理
 * 3. 支持手动刷新
 */
export function useDungeonLimit(hasCultivator: boolean) {
  const [limitInfo, setLimitInfo] = useState<DungeonLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(hasCultivator);
  const [error, setError] = useState<string | null>(null);

  const fetchLimit = async () => {
    if (!hasCultivator) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/dungeon/limit');
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.success && data.data) {
        setLimitInfo(data.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取次数限制失败');
      setLimitInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 自动加载
  useEffect(() => {
    if (!hasCultivator) {
      return;
    }

    let cancelled = false;

    const loadLimit = async () => {
      try {
        const res = await fetch('/api/dungeon/limit');
        const data = await res.json();

        if (cancelled) return;

        if (data.error) {
          throw new Error(data.error);
        }

        if (data.success && data.data) {
          setLimitInfo(data.data);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '获取次数限制失败');
        setLimitInfo(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLimit();

    return () => {
      cancelled = true;
    };
  }, [hasCultivator]);

  const refresh = () => {
    fetchLimit();
  };

  return {
    limitInfo,
    isLoading,
    error,
    refresh,
  };
}
