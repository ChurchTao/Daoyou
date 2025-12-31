'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type {
  Cultivator,
  EquippedItems,
  Inventory,
  Skill,
} from '@/types/cultivator';
import {
  calculateFinalAttributes,
  FinalAttributesResult,
} from '@/utils/cultivatorUtils';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================
// 类型定义
// ============================================================

type FetchState = {
  cultivator: Cultivator | null;
  finalAttributes: FinalAttributesResult | null;
  inventory: Inventory;
  skills: Skill[];
  equipped: EquippedItems;
  isLoading: boolean;
  error?: string;
  note?: string;
  unreadMailCount: number;
  hasActiveCultivator: boolean;
};

const defaultInventory: Inventory = {
  artifacts: [],
  consumables: [],
  materials: [],
};

const defaultEquipped: EquippedItems = {
  weapon: null,
  armor: null,
  accessory: null,
};

const initialState: FetchState = {
  cultivator: null,
  finalAttributes: null,
  inventory: defaultInventory,
  skills: [],
  equipped: defaultEquipped,
  isLoading: false,
  error: undefined,
  note: undefined,
  unreadMailCount: 0,
  hasActiveCultivator: false,
};

// ============================================================
// 模块级缓存（简化版）
// ============================================================

let cachedState: FetchState | null = null;
let cachedUserId: string | null = null;

function getCachedState(userId: string | null): FetchState | null {
  if (cachedUserId === userId && cachedState) {
    return cachedState;
  }
  return null;
}

function setCachedState(state: FetchState, userId: string | null) {
  cachedState = state;
  cachedUserId = userId;
}

function clearCache() {
  cachedState = null;
  cachedUserId = null;
}

// ============================================================
// 数据获取函数
// ============================================================

async function fetchCultivatorData(): Promise<{
  cultivator: Cultivator | null;
  hasActive: boolean;
  hasDead: boolean;
}> {
  const response = await fetch('/api/cultivators');
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || '未获取到角色数据');
  }

  const list: Cultivator[] = result.data || [];
  return {
    cultivator: list[0] || null,
    hasActive: !!result.meta?.hasActive,
    hasDead: !!result.meta?.hasDead,
  };
}

async function fetchInventoryData(): Promise<{
  consumables: [];
  materials: [];
  artifacts: [];
} | null> {
  try {
    const res = await fetch('/api/cultivator/inventory');
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (e) {
    console.error('获取背包失败', e);
    return null;
  }
}

async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch('/api/cultivator/mail/unread-count');
    if (res.ok) {
      const data = await res.json();
      return data.count || 0;
    }
    return 0;
  } catch (e) {
    console.error('获取未读邮件失败', e);
    return 0;
  }
}

// ============================================================
// 主 Hook
// ============================================================

export function useCultivatorBundle() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const router = useRouter();

  // 使用 ref 跟踪加载状态，避免重复请求
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // 从缓存初始化状态
  const [state, setState] = useState<FetchState>(() => {
    const cached = getCachedState(userId);
    return cached || initialState;
  });

  // ========== 辅助函数：更新状态并同步缓存 ==========
  const updateState = useCallback(
    (updater: FetchState | ((prev: FetchState) => FetchState)) => {
      setState((prev) => {
        const newState =
          typeof updater === 'function' ? updater(prev) : updater;
        // 同步更新缓存
        setCachedState(newState, userId);
        return newState;
      });
    },
    [userId],
  );

  // ========== 核心加载函数 ==========
  const loadFromServer = useCallback(async () => {
    if (!userId) {
      clearCache();
      setState(initialState);
      return;
    }

    // 防止重复请求
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = true;

    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // 1. 获取核心角色数据
      const { cultivator, hasActive, hasDead } = await fetchCultivatorData();

      if (!hasActive || !cultivator) {
        const noActiveState: FetchState = {
          ...initialState,
          note: hasDead ? '前世道途已尽，待转世重修。' : undefined,
          hasActiveCultivator: false,
        };
        setCachedState(noActiveState, userId);
        setState(noActiveState);
        return;
      }

      // 2. 并行获取附属数据
      const [inventoryData, unreadCount] = await Promise.all([
        fetchInventoryData(),
        fetchUnreadCount(),
      ]);

      // 3. 组装完整数据
      const inventory: Inventory = {
        artifacts: inventoryData?.artifacts || [],
        consumables: inventoryData?.consumables || [],
        materials: inventoryData?.materials || [],
      };

      const fullCultivator: Cultivator = {
        ...cultivator,
        inventory,
        skills: cultivator.skills || [],
        equipped: cultivator.equipped || defaultEquipped,
      };

      // 4. 设置完整状态
      const newState: FetchState = {
        cultivator: fullCultivator,
        finalAttributes: calculateFinalAttributes(fullCultivator),
        inventory,
        skills: fullCultivator.skills || [],
        equipped: fullCultivator.equipped || defaultEquipped,
        isLoading: false,
        error: undefined,
        note: undefined,
        unreadMailCount: unreadCount || 0,
        hasActiveCultivator: true,
      };

      setCachedState(newState, userId);
      setState(newState);
    } catch (error) {
      console.warn('加载角色资料失败：', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  // ========== 细粒度刷新函数 ==========
  const refreshInventory = useCallback(async () => {
    if (!state.cultivator?.id) return;

    const data = await fetchInventoryData();
    if (!data) return;

    updateState((prev) => {
      if (!prev.cultivator) return prev;

      const newInventory: Inventory = {
        ...prev.inventory,
        consumables: data.consumables,
        materials: data.materials,
        artifacts: data.artifacts,
      };

      return {
        ...prev,
        cultivator: { ...prev.cultivator, inventory: newInventory },
        inventory: newInventory,
      };
    });
  }, [state.cultivator?.id, updateState]);

  // ========== 初始化逻辑 ==========
  useEffect(() => {
    // 无用户时重置
    if (!userId) {
      if (lastUserIdRef.current !== null) {
        clearCache();
        setState(initialState);
      }
      lastUserIdRef.current = null;
      return;
    }

    // 用户未变化，跳过
    if (lastUserIdRef.current === userId) {
      return;
    }

    // 用户变化
    lastUserIdRef.current = userId;

    // 检查是否有缓存
    const cached = getCachedState(userId);
    if (cached) {
      setState(cached);
      return;
    }

    // 无缓存，从服务器加载
    loadFromServer();
  }, [userId, loadFromServer]);

  // ========== 死亡重定向 ==========
  useEffect(() => {
    const cultivator = state.cultivator;
    if (!cultivator) return;

    const isDead =
      cultivator.status === 'dead' || cultivator.age >= cultivator.lifespan;

    if (!isDead) return;

    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/reincarnate'
    ) {
      router.push('/reincarnate');
    }
  }, [state.cultivator, router]);

  // ========== 返回值 ==========
  return {
    ...state,
    refresh: loadFromServer,
    refreshInventory,
  };
}
