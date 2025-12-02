'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type {
  Cultivator,
  EquippedItems,
  Inventory,
  Skill,
} from '@/types/cultivator';
import { useCallback, useEffect, useState } from 'react';

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

export function useCultivatorBundle() {
  const { user } = useAuth();
  const [state, setState] = useState<FetchState>({
    cultivator: null,
    inventory: defaultInventory,
    skills: [],
    equipped: { weapon: null, armor: null, accessory: null },
    isLoading: false,
    usingMock: false,
  });

  const loadFromServer = useCallback(async () => {
    if (!user) {
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

      setState({
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
      });
    } catch (error) {
      console.warn('加载角色资料失败，回退到占位数据：', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [user]);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  return {
    ...state,
    refresh: loadFromServer,
  };
}
