/**
 * CultivatorUnit 单元测试
 *
 * 测试持久化状态清理功能
 */

import type { Cultivator } from '@/types/cultivator';
import type { BuffInstanceState } from '../buff/types';
import { CultivatorUnit } from './CultivatorUnit';

describe('CultivatorUnit - 持久化状态清理', () => {
  // 辅助函数：创建最小化 Cultivator 对象
  function createMockCultivator(
    persistentStatuses?: BuffInstanceState[],
  ): Cultivator {
    return {
      name: '测试道友',
      gender: '男',
      realm: '炼气',
      realm_stage: '初期',
      age: 16,
      lifespan: 80,
      attributes: {
        vitality: 10,
        spirit: 10,
        wisdom: 10,
        speed: 10,
        willpower: 10,
      },
      spiritual_roots: [],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: {
        artifacts: [],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: null,
        armor: null,
        accessory: null,
      },
      max_skills: 5,
      spirit_stones: 1000,
      persistent_statuses: persistentStatuses || [],
    };
  }

  describe('getValidPersistentStatuses', () => {
    it('应该返回所有有效的持久化状态', () => {
      const now = Date.now();
      const future = now + 3600000; // 1小时后

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'test_buff_1',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: future },
        },
        {
          instanceId: '2',
          configId: 'test_buff_2',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: 0 }, // 永久
        },
        {
          instanceId: '3',
          configId: 'test_buff_3',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { usesRemaining: 5 }, // 有剩余次数
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      const validStatuses = unit.getValidPersistentStatuses();

      expect(validStatuses).toHaveLength(3);
    });

    it('应该过滤掉过期的持久化状态', () => {
      const now = Date.now();
      const past = now - 3600000; // 1小时前
      const future = now + 3600000; // 1小时后

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'valid_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: future },
        },
        {
          instanceId: '2',
          configId: 'expired_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: past }, // 已过期
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      const validStatuses = unit.getValidPersistentStatuses();

      expect(validStatuses).toHaveLength(1);
      expect(validStatuses[0].instanceId).toBe('1');
    });

    it('应该过滤掉使用次数耗尽的持久化状态', () => {
      const now = Date.now();

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'has_uses_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { usesRemaining: 3 },
        },
        {
          instanceId: '2',
          configId: 'no_uses_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { usesRemaining: 0 }, // 使用次数耗尽
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      const validStatuses = unit.getValidPersistentStatuses();

      expect(validStatuses).toHaveLength(1);
      expect(validStatuses[0].instanceId).toBe('1');
    });

    it('应该处理空数组', () => {
      const cultivator = createMockCultivator([]);
      const unit = new CultivatorUnit(cultivator);

      const validStatuses = unit.getValidPersistentStatuses();

      expect(validStatuses).toHaveLength(0);
    });

    it('应该处理 undefined 的 persistent_statuses', () => {
      const cultivator = createMockCultivator(undefined);
      const unit = new CultivatorUnit(cultivator);

      const validStatuses = unit.getValidPersistentStatuses();

      expect(validStatuses).toHaveLength(0);
    });

    it('应该同时过滤过期和使用次数耗尽的状态', () => {
      const now = Date.now();
      const past = now - 3600000;
      const future = now + 3600000;

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'valid',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: future, usesRemaining: 5 },
        },
        {
          instanceId: '2',
          configId: 'expired',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: past, usesRemaining: 5 },
        },
        {
          instanceId: '3',
          configId: 'no_uses',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: future, usesRemaining: 0 },
        },
        {
          instanceId: '4',
          configId: 'both_bad',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: past, usesRemaining: 0 },
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      const validStatuses = unit.getValidPersistentStatuses();

      expect(validStatuses).toHaveLength(1);
      expect(validStatuses[0].instanceId).toBe('1');
    });
  });

  describe('hasDirtyPersistentStatuses', () => {
    it('当有过期状态时应返回 true', () => {
      const now = Date.now();
      const past = now - 3600000;

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'valid_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: now + 3600000 },
        },
        {
          instanceId: '2',
          configId: 'expired_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: past },
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      expect(unit.hasDirtyPersistentStatuses()).toBe(true);
    });

    it('当有使用次数耗尽的状态时应返回 true', () => {
      const now = Date.now();

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'has_uses_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { usesRemaining: 5 },
        },
        {
          instanceId: '2',
          configId: 'no_uses_buff',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { usesRemaining: 0 },
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      expect(unit.hasDirtyPersistentStatuses()).toBe(true);
    });

    it('当所有状态有效时应返回 false', () => {
      const now = Date.now();
      const future = now + 3600000;

      const statuses: BuffInstanceState[] = [
        {
          instanceId: '1',
          configId: 'test_buff_1',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { expiresAt: future },
        },
        {
          instanceId: '2',
          configId: 'test_buff_2',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: now,
          metadata: { usesRemaining: 5 },
        },
      ];

      const cultivator = createMockCultivator(statuses);
      const unit = new CultivatorUnit(cultivator);

      expect(unit.hasDirtyPersistentStatuses()).toBe(false);
    });

    it('当没有持久化状态时应返回 false', () => {
      const cultivator = createMockCultivator([]);
      const unit = new CultivatorUnit(cultivator);

      expect(unit.hasDirtyPersistentStatuses()).toBe(false);
    });

    it('当 persistent_statuses 为 undefined 时应返回 false', () => {
      const cultivator = createMockCultivator(undefined);
      const unit = new CultivatorUnit(cultivator);

      expect(unit.hasDirtyPersistentStatuses()).toBe(false);
    });
  });
});
