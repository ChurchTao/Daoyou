import type { DivineFortune } from '@/utils/divineFortune';
import { getRandomFallbackFortune } from '@/utils/divineFortune';
import { useEffect, useState } from 'react';
import { fetchJsonCached } from '@/lib/client/requestCache';

/**
 * 获取天机推演的 Hook
 * 从 API 获取 AIGC 生成的天机格言
 */
export function useDivineFortune() {
  const [fortune, setFortune] = useState<DivineFortune | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchFortune = async () => {
      try {
        const result = await fetchJsonCached<{
          success: boolean;
          data?: DivineFortune;
        }>('/api/divine-fortune', {
          key: 'home:divine-fortune',
          ttlMs: 5 * 60 * 1000,
        });

        if (cancelled) return;
        if (result.success && result.data) {
          setFortune(result.data);
        } else {
          // 降级到本地备用方案
          setFortune(getRandomFallbackFortune());
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch divine fortune:', err);
        setError('获取天机失败');
        // 降级到本地备用方案
        setFortune(getRandomFallbackFortune());
      } finally {
        if (cancelled) return;
        setIsLoading(false);
      }
    };

    fetchFortune();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    fortune,
    isLoading,
    error,
  };
}
