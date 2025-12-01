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
  equipments: [],
  consumables: [],
};

const mockCultivator: Cultivator = {
  id: 'mock-linqingluo',
  name: '林青萝',
  prompt: '以药修与木灵为核心的女修',
  cultivationLevel: '筑基中期',
  spiritRoot: '药王谷弟子',
  appearance: '青衣白裙，墨发若瀑',
  backstory: '药王谷真传弟子，兼修丹道与木灵，擅以藤木护道。',
  origin: '药王谷',
  gender: '女',
  personality: '温和克制，心怀慈悲',
  preHeavenFates: [
    {
      name: '紫府通明',
      type: '吉',
      effect: '元神澄澈，灵识通透',
      description: 'Spirit +15',
    },
    {
      name: '孤辰入命',
      type: '凶',
      effect: '悟性 -5，不可结道侣',
      description: '悟性降低且无法结成道侣',
    },
    {
      name: '草莽龙气',
      type: '吉',
      effect: '体魄异于常人',
      description: 'Vitality +10',
    },
  ],
  maxEquipments: 5,
  maxSkills: 3,
  battleProfile: {
    maxHp: 100,
    hp: 92,
    attributes: {
      vitality: 78,
      spirit: 95,
      wisdom: 75,
      speed: 70,
    },
    element: '木',
    skills: [],
  },
};

const mockInventory: Inventory = {
  equipments: [
    {
      id: 'mock-weapon',
      name: '焚天剑',
      type: 'weapon',
      element: '火',
      quality: '道器',
      specialEffect: '+spirit 15｜火系伤害 +25%',
    },
    {
      id: 'mock-staff',
      name: '青木灵杖',
      type: 'weapon',
      element: '木',
      quality: '宝器',
      specialEffect: '+spirit 10｜木系技能威力 +30%',
    },
    {
      id: 'mock-armor',
      name: '玄龟甲',
      type: 'armor',
      element: '水',
      quality: '灵器',
      specialEffect: '+vitality 12｜受到伤害 -10%',
    },
    {
      id: 'mock-accessory',
      name: '青木玉佩',
      type: 'accessory',
      element: '木',
      quality: '宝器',
      specialEffect: '+wisdom 8｜木系技能冷却 -10%',
    },
  ],
  consumables: [],
};

const mockSkills: Skill[] = [
  {
    name: '藤蔓缚',
    type: 'control',
    power: 60,
    element: '木',
    effects: ['缠绕（减速）'],
  },
  {
    name: '回春诀',
    type: 'heal',
    power: 50,
    element: '木',
    effects: ['恢复 40 气血'],
  },
  {
    name: '九霄雷引',
    type: 'attack',
    power: 85,
    element: '雷',
    effects: ['暴击率 +15%'],
  },
];

const mockEquipped: EquippedItems = {
  weapon: 'mock-weapon',
  armor: 'mock-armor',
  accessory: 'mock-accessory',
};

export function useCultivatorBundle() {
  const { user } = useAuth();
  const [state, setState] = useState<FetchState>({
    cultivator: null,
    inventory: defaultInventory,
    skills: [],
    equipped: {},
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
        equipped: {},
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

      const [inventoryRes, skillsRes, equippedRes] = await Promise.all([
        fetch(`/api/cultivators/${cultivator.id}/inventory`),
        fetch(`/api/create-skill?cultivatorId=${cultivator.id}`),
        fetch(`/api/cultivators/${cultivator.id}/equip`),
      ]);

      const inventoryJson = await inventoryRes.json();
      const skillsJson = await skillsRes.json();
      const equippedJson = await equippedRes.json();

      setState({
        cultivator,
        inventory: inventoryJson.success ? inventoryJson.data : defaultInventory,
        skills: skillsJson.success ? skillsJson.data : [],
        equipped: equippedJson.success ? equippedJson.data : {},
        isLoading: false,
        error: undefined,
        note: undefined,
        usingMock: false,
      });
    } catch (error) {
      console.warn('加载角色资料失败，回退到占位数据：', error);
      setState({
        cultivator: mockCultivator,
        inventory: mockInventory,
        skills: mockSkills,
        equipped: mockEquipped,
        isLoading: false,
        error: error instanceof Error ? error.message : '加载角色资料失败',
        note: '【占位数据】后端接口暂未返回数据，当前为硬编码示例，仅供 UI 联调。',
        usingMock: true,
      });
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

