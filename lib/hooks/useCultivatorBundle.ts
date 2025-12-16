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

type FetchState = {
  cultivator: Cultivator | null;
  finalAttributes: FinalAttributesResult | null;
  inventory: Inventory;
  skills: Skill[];
  equipped: EquippedItems;
  isLoading: boolean;
  error?: string;
  note?: string;
};

const defaultInventory: Inventory = {
  artifacts: [],
  consumables: [],
  materials: [],
};

// 模块级别的缓存，在页面切换时保持数据
let cachedData: FetchState | null = null;
let cachedUserId: string | null = null;

export function useCultivatorBundle() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const router = useRouter();

  // 使用 ref 来跟踪是否已经初始化过
  const initializedRef = useRef(false);

  // 初始化时从缓存恢复数据（如果存在且用户ID匹配）
  const [state, setState] = useState<FetchState>(() => {
    // 注意：这里 userId 可能还是 null（首次渲染时），所以只检查缓存是否存在
    // 实际的用户ID匹配会在 useEffect 中处理
    if (cachedData && cachedUserId) {
      return cachedData;
    }
    return {
      cultivator: null,
      finalAttributes: null,
      inventory: defaultInventory,
      skills: [],
      equipped: { weapon: null, armor: null, accessory: null },
      isLoading: false,
    };
  });

  // 提取通用获取逻辑，不包含 setState
  const fetchInventoryData = useCallback(async (cultivatorId: string) => {
    try {
      const res = await fetch(`/api/cultivators/${cultivatorId}/inventory`);
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.error('获取背包失败', e);
      return null;
    }
  }, []);

  const fetchHistoryData = useCallback(async (cultivatorId: string) => {
    try {
      const res = await fetch(`/api/cultivators/${cultivatorId}/history`);
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.error('获取历史记录失败', e);
      return null;
    }
  }, []);

  // 单独刷新背包数据 (Consumables, Materials, Artifacts)
  const refreshInventory = useCallback(async () => {
    if (!state.cultivator?.id) return;
    const data = await fetchInventoryData(state.cultivator.id);

    if (data) {
      setState((prev) => {
        if (!prev.cultivator) return prev;

        const newInventory = {
          ...prev.inventory,
          consumables: data.consumables,
          materials: data.materials,
          artifacts: data.artifacts,
        };

        const newCultivator = {
          ...prev.cultivator,
          inventory: newInventory,
        };

        // 更新缓存
        if (cachedData) {
          cachedData = {
            ...cachedData,
            cultivator: newCultivator,
            inventory: newInventory,
          };
        }

        return {
          ...prev,
          cultivator: newCultivator,
          inventory: newInventory,
        };
      });
    }
  }, [state.cultivator?.id, fetchInventoryData]);

  // 单独刷新历史记录 (Retreat, Breakthrough)
  const refreshHistory = useCallback(async () => {
    if (!state.cultivator?.id) return;
    const data = await fetchHistoryData(state.cultivator.id);

    if (data) {
      setState((prev) => {
        if (!prev.cultivator) return prev;

        const newCultivator = {
          ...prev.cultivator,
          retreat_records: data.retreat_records,
          breakthrough_history: data.breakthrough_history,
        };

        if (cachedData) {
          cachedData = {
            ...cachedData,
            cultivator: newCultivator,
          };
        }

        return {
          ...prev,
          cultivator: newCultivator,
        };
      });
    }
  }, [state.cultivator?.id, fetchHistoryData]);

  const loadFromServer = useCallback(async () => {
    if (!userId) {
      cachedData = null;
      cachedUserId = null;
      setState((prev) => ({
        ...prev,
        cultivator: null,
        inventory: defaultInventory,
        skills: [],
        equipped: { weapon: null, armor: null, accessory: null },
        isLoading: false,
        error: undefined,
        note: undefined,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // 1. 获取核心数据
      const cultivatorResponse = await fetch('/api/cultivators');
      const cultivatorResult = await cultivatorResponse.json();

      if (!cultivatorResponse.ok || !cultivatorResult.success) {
        throw new Error(cultivatorResult.error || '未获取到角色数据');
      }

      const list: Cultivator[] = cultivatorResult.data || [];
      const hasActive = !!cultivatorResult.meta?.hasActive;
      const hasDead = !!cultivatorResult.meta?.hasDead;

      if (!hasActive) {
        setState((prev) => ({
          ...prev,
          cultivator: null,
          inventory: defaultInventory,
          skills: [],
          equipped: { weapon: null, armor: null, accessory: null },
          isLoading: false,
          error: undefined,
          note: hasDead ? '前世道途已尽，待转世重修。' : undefined,
        }));
        cachedData = null;
        cachedUserId = userId;
        return;
      }

      const cultivator: Cultivator = list[0];

      // 2. 并行获取背包和历史记录
      const [inventoryData, historyData] = await Promise.all([
        fetchInventoryData(cultivator.id!),
        fetchHistoryData(cultivator.id!),
      ]);

      // 3. 组装完整数据
      // 核心数据已加载，清单可能不完整（consumables/materials 是空的）
      // 这里只处理核心数据中已有的部分，然后用 fetch 到的数据覆盖
      const baseInventory = cultivator.inventory || defaultInventory;

      const inventory = {
        ...baseInventory,
        consumables: inventoryData?.consumables || [],
        materials: inventoryData?.materials || [],
        artifacts: inventoryData?.artifacts || [],
      };

      const skills = cultivator.skills || [];
      const equipped = cultivator.equipped || {
        weapon: null,
        armor: null,
        accessory: null,
      };

      const retreat_records = historyData?.retreat_records || [];
      const breakthrough_history = historyData?.breakthrough_history || [];

      const fullCultivator = {
        ...cultivator,
        inventory,
        skills,
        equipped,
        retreat_records,
        breakthrough_history,
      };

      const newState = {
        cultivator: fullCultivator,
        inventory,
        skills,
        equipped,
        isLoading: false,
        error: undefined,
        note: undefined,
        finalAttributes: calculateFinalAttributes(fullCultivator),
      };

      // 更新缓存
      cachedData = newState;
      cachedUserId = userId;

      setState(newState);
    } catch (error) {
      console.warn('加载角色资料失败，回退到占位数据：', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [userId, fetchInventoryData, fetchHistoryData]);

  useEffect(() => {
    // 如果没有用户，清除缓存
    if (!userId) {
      if (cachedData) {
        cachedData = null;
        cachedUserId = null;
      }
      initializedRef.current = false;
      return;
    }

    // 如果用户ID变化，清除缓存并重新加载
    if (cachedUserId !== userId) {
      cachedData = null;
      cachedUserId = null;
      initializedRef.current = false;
    }

    // 如果缓存存在且用户ID匹配，直接使用缓存数据（不重新加载）
    if (cachedData && cachedUserId === userId) {
      if (!initializedRef.current) {
        setState(cachedData);
        initializedRef.current = true;
      }
      return;
    }

    // 只有在以下情况才从服务器加载：
    // 1. 有用户
    // 2. 没有缓存数据或用户ID不匹配
    // 3. 还未初始化过
    if (!initializedRef.current) {
      loadFromServer();
      initializedRef.current = true;
    }
  }, [userId, loadFromServer]);

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

  return {
    ...state,
    refresh: loadFromServer,
    refreshInventory,
    refreshHistory,
  };
}
