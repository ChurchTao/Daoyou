'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type {
  Cultivator,
  EquippedItems,
  Inventory,
  Skill,
} from '@/types/cultivator';
import { useCallback, useEffect, useRef, useState } from 'react';

type FetchState = {
  cultivator: Cultivator | null;
  inventory: Inventory;
  skills: Skill[];
  equipped: EquippedItems;
  isLoading: boolean;
  error?: string;
  note?: string;
  usingMock: boolean;
};

const defaultInventory: Inventory = {
  artifacts: [],
  consumables: [],
};

// 模块级别的缓存，在页面切换时保持数据
let cachedData: FetchState | null = null;
let cachedUserId: string | null = null;

export function useCultivatorBundle() {
  const { user } = useAuth();
  const userId = user?.id || null;

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
      inventory: defaultInventory,
      skills: [],
      equipped: { weapon: null, armor: null, accessory: null },
      isLoading: false,
      usingMock: false,
    };
  });

  const loadFromServer = useCallback(async () => {
    if (!user) {
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
        usingMock: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const cultivatorResponse = await fetch('/api/cultivators');
      const cultivatorResult = await cultivatorResponse.json();

      if (
        !cultivatorResponse.ok ||
        !cultivatorResult.success ||
        cultivatorResult.data.length === 0
      ) {
        throw new Error('未获取到角色数据');
      }

      const cultivator: Cultivator = cultivatorResult.data[0];

      // 新模型中，Cultivator 已经包含完整的 inventory、skills、equipped 数据
      // 如果 API 返回的数据不完整，可以从单独的接口获取（向后兼容）
      let inventory = cultivator.inventory || defaultInventory;
      let skills = cultivator.skills || [];
      let equipped = cultivator.equipped || {
        weapon: null,
        armor: null,
        accessory: null,
      };

      // 如果数据不完整，尝试从单独接口获取（向后兼容）
      if (!inventory.artifacts || inventory.artifacts.length === 0) {
        try {
          const inventoryRes = await fetch(
            `/api/cultivators/${cultivator.id}/inventory`,
          );
          const inventoryJson = await inventoryRes.json();
          if (inventoryJson.success) {
            inventory = inventoryJson.data;
          }
        } catch {
          // 忽略错误，使用默认值
        }
      }

      if (!skills || skills.length === 0) {
        try {
          const skillsRes = await fetch(
            `/api/create-skill?cultivatorId=${cultivator.id}`,
          );
          const skillsJson = await skillsRes.json();
          if (skillsJson.success) {
            skills = skillsJson.data;
          }
        } catch {
          // 忽略错误，使用默认值
        }
      }

      if (
        !equipped ||
        (!equipped.weapon && !equipped.armor && !equipped.accessory)
      ) {
        try {
          const equippedRes = await fetch(
            `/api/cultivators/${cultivator.id}/equip`,
          );
          const equippedJson = await equippedRes.json();
          if (equippedJson.success) {
            equipped = equippedJson.data;
          }
        } catch {
          // 忽略错误，使用默认值
        }
      }

      const newState = {
        cultivator: {
          ...cultivator,
          inventory,
          skills,
          equipped,
        },
        inventory,
        skills,
        equipped,
        isLoading: false,
        error: undefined,
        note: undefined,
        usingMock: false,
      };

      // 更新缓存
      cachedData = newState;
      cachedUserId = user.id;

      setState(newState);
    } catch (error) {
      console.warn('加载角色资料失败，回退到占位数据：', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [user]);

  useEffect(() => {
    // 如果没有用户，清除缓存
    if (!user) {
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
  }, [user, userId, loadFromServer]);

  return {
    ...state,
    refresh: loadFromServer,
  };
}
