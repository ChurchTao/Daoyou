import type { DivineFortune } from '@/utils/divineFortune';
import { getRandomFallbackFortune } from '@/utils/divineFortune';
import { useEffect, useState } from 'react';

/**
 * 获取天机推演的 Hook
 * 从 API 获取 AIGC 生成的天机格言
 */
export function useDivineFortune() {
  const [fortune, setFortune] = useState<DivineFortune | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFortune = async () => {
      try {
        const response = await fetch('/api/divine-fortune');
        const result = await response.json();

        if (result.success && result.data) {
          setFortune(result.data);
        } else {
          // 降级到本地备用方案
          setFortune(getRandomFallbackFortune());
        }
      } catch (err) {
        console.error('Failed to fetch divine fortune:', err);
        setError('获取天机失败');
        // 降级到本地备用方案
        setFortune(getRandomFallbackFortune());
      } finally {
        setIsLoading(false);
      }
    };

    fetchFortune();
  }, []);

  return {
    fortune,
    isLoading,
    error,
  };
}
