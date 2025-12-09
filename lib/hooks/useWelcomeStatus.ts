import { useCallback, useEffect, useState } from 'react';

const WELCOME_STORAGE_KEY = 'wanjiedaoyou_welcome_status';

export interface WelcomeStatus {
  skipWelcome: boolean;
  lastVisitTime?: number;
  visitCount: number;
}

/**
 * 欢迎页状态管理 Hook
 * 管理用户是否跳过欢迎页的偏好
 */
export function useWelcomeStatus() {
  const [status, setStatus] = useState<WelcomeStatus>({
    skipWelcome: false,
    visitCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // 从 localStorage 读取状态
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WELCOME_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WelcomeStatus;
        setStatus(parsed);
      }
    } catch (error) {
      console.error('Failed to load welcome status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 更新跳过状态
  const setSkipWelcome = useCallback((skip: boolean) => {
    setStatus((prevStatus) => {
      const newStatus: WelcomeStatus = {
        ...prevStatus,
        skipWelcome: skip,
        lastVisitTime: Date.now(),
      };
      try {
        localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(newStatus));
      } catch (error) {
        console.error('Failed to save welcome status:', error);
      }
      return newStatus;
    });
  }, []);

  // 记录访问
  const recordVisit = useCallback(() => {
    setStatus((prevStatus) => {
      const newStatus: WelcomeStatus = {
        ...prevStatus,
        visitCount: prevStatus.visitCount + 1,
        lastVisitTime: Date.now(),
      };
      try {
        localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(newStatus));
      } catch (error) {
        console.error('Failed to save welcome status:', error);
      }
      return newStatus;
    });
  }, []);

  // 计算距离上次访问的天数
  const getDaysSinceLastVisit = (): number => {
    if (!status.lastVisitTime) return 0;
    const now = Date.now();
    const diff = now - status.lastVisitTime;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // 是否首次访问
  const isFirstVisit = status.visitCount === 0;

  return {
    status,
    isLoading,
    skipWelcome: status.skipWelcome,
    isFirstVisit,
    setSkipWelcome,
    recordVisit,
    getDaysSinceLastVisit,
  };
}
