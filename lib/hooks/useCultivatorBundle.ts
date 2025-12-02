'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import type { Cultivator, EquippedItems, Inventory, Skill } from '@/types/cultivator';
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

const mockCultivator: Cultivator = {
  id: 'mock-linqingluo',
  name: '林青萝',
  prompt: '以药修与木灵为核心的女修',
  gender: '女',
  origin: '药王谷',
  personality: '温和克制，心怀慈悲',
  realm: '筑基',
  realm_stage: '中期',
  age: 25,
  lifespan: 200,
  attributes: {
    vitality: 78,
    spirit: 95,
    wisdom: 75,
    speed: 70,
    willpower: 80,
  },
  spiritual_roots: [
    { element: '木', strength: 85 },
  ],
  pre_heaven_fates: [
    {
      name: '紫府通明',
      type: '吉',
      attribute_mod: { spirit: 15 },
      description: '元神澄澈，灵识通透',
    },
    {
      name: '孤辰入命',
      type: '凶',
      attribute_mod: { wisdom: -5 },
      description: '悟性降低且无法结成道侣',
    },
    {
      name: '草莽龙气',
      type: '吉',
      attribute_mod: { vitality: 10 },
      description: '体魄异于常人',
    },
  ],
  cultivations: [],
  skills: [
    {
      id: 'sk_mock_1',
      name: '藤蔓缚',
      type: 'control',
      power: 60,
      element: '木',
      cooldown: 2,
      effect: 'root',
      duration: 2,
    },
    {
      id: 'sk_mock_2',
      name: '回春诀',
      type: 'heal',
      power: 50,
      element: '木',
      cooldown: 1,
    },
    {
      id: 'sk_mock_3',
      name: '九霄雷引',
      type: 'attack',
      power: 85,
      element: '雷',
      cooldown: 2,
    },
  ],
  inventory: {
    artifacts: [
      {
        id: 'mock-weapon',
        name: '焚天剑',
        slot: 'weapon',
        element: '火',
        bonus: { spirit: 15 },
        special_effects: [],
        curses: [],
      },
      {
        id: 'mock-armor',
        name: '玄龟甲',
        slot: 'armor',
        element: '水',
        bonus: { vitality: 12 },
        special_effects: [],
        curses: [],
      },
      {
        id: 'mock-accessory',
        name: '青木玉佩',
        slot: 'accessory',
        element: '木',
        bonus: { wisdom: 8 },
        special_effects: [],
        curses: [],
      },
    ],
    consumables: [],
  },
  equipped: {
    weapon: 'mock-weapon',
    armor: 'mock-armor',
    accessory: 'mock-accessory',
  },
  max_skills: 3,
  background: '药王谷真传弟子，兼修丹道与木灵，擅以藤木护道。',
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

      if (!cultivatorResponse.ok || !cultivatorResult.success || cultivatorResult.data.length === 0) {
        throw new Error('未获取到角色数据');
      }

      const cultivator: Cultivator = cultivatorResult.data[0];

      // 新模型中，Cultivator 已经包含完整的 inventory、skills、equipped 数据
      // 如果 API 返回的数据不完整，可以从单独的接口获取（向后兼容）
      let inventory = cultivator.inventory || defaultInventory;
      let skills = cultivator.skills || [];
      let equipped = cultivator.equipped || { weapon: null, armor: null, accessory: null };

      // 如果数据不完整，尝试从单独接口获取（向后兼容）
      if (!inventory.artifacts || inventory.artifacts.length === 0) {
        try {
          const inventoryRes = await fetch(`/api/cultivators/${cultivator.id}/inventory`);
          const inventoryJson = await inventoryRes.json();
          if (inventoryJson.success) {
            inventory = inventoryJson.data;
          }
        } catch (e) {
          // 忽略错误，使用默认值
        }
      }

      if (!skills || skills.length === 0) {
        try {
          const skillsRes = await fetch(`/api/create-skill?cultivatorId=${cultivator.id}`);
          const skillsJson = await skillsRes.json();
          if (skillsJson.success) {
            skills = skillsJson.data;
          }
        } catch (e) {
          // 忽略错误，使用默认值
        }
      }

      if (!equipped || (!equipped.weapon && !equipped.armor && !equipped.accessory)) {
        try {
          const equippedRes = await fetch(`/api/cultivators/${cultivator.id}/equip`);
          const equippedJson = await equippedRes.json();
          if (equippedJson.success) {
            equipped = equippedJson.data;
          }
        } catch (e) {
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
      setState(
        prev=>({
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

