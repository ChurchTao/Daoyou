import { StatusContainer } from './StatusContainer';
import { statusRegistry } from './StatusRegistry';
import type {
  StatusApplicationRequest,
  TickContext,
  UnitSnapshot,
} from './types';

describe('StatusContainer', () => {
  let container: StatusContainer;
  let mockTarget: UnitSnapshot;

  beforeEach(() => {
    container = new StatusContainer();
    mockTarget = {
      unitId: 'test-unit',
      currentHp: 1000,
      currentMp: 500,
      maxHp: 1000,
      maxMp: 500,
      baseAttributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 100,
        willpower: 100,
      },
    };
  });

  describe('addStatus', () => {
    it('应该成功添加buff状态', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'armor_up',
        source: {
          sourceType: 'skill',
          sourceName: '护体术',
        },
      };

      const result = container.addStatus(request, mockTarget);

      expect(result.success).toBe(true);
      expect(result.statusId).toBeDefined();
      expect(result.message).toContain('护体');
      expect(container.hasStatus('armor_up')).toBe(true);
    });

    it('应该拒绝未注册的状态', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'unknown_status' as unknown as StatusEffect,
        source: {
          sourceType: 'system',
          sourceName: 'test',
        },
      };

      const result = container.addStatus(request, mockTarget);

      expect(result.success).toBe(false);
      expect(result.message).toContain('未知的状态类型');
    });

    it('应该处理状态互斥', () => {
      // 先添加armor_up
      const request1: StatusApplicationRequest = {
        statusKey: 'armor_up',
        source: { sourceType: 'skill', sourceName: '护体术' },
      };
      container.addStatus(request1, mockTarget);

      // 再添加armor_down(与armor_up互斥)
      const request2: StatusApplicationRequest = {
        statusKey: 'armor_down',
        source: { sourceType: 'skill', sourceName: '破防术' },
      };
      const result = container.addStatus(request2, mockTarget);

      expect(result.success).toBe(true);
      expect(container.hasStatus('armor_up')).toBe(false);
      expect(container.hasStatus('armor_down')).toBe(true);
    });

    it('应该支持状态叠加', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'burn',
        source: {
          sourceType: 'skill',
          sourceName: '火球术',
          casterSnapshot: {
            casterId: 'caster',
            casterName: '施法者',
            attributes: mockTarget.baseAttributes,
          },
        },
      };

      // 第一次添加
      const result1 = container.addStatus(request, mockTarget);
      expect(result1.success).toBe(true);

      // 第二次添加(应该叠加)
      const result2 = container.addStatus(request, mockTarget);
      expect(result2.success).toBe(true);

      const statuses = container.getActiveStatuses();
      const burnStatuses = statuses.filter((s) => s.statusKey === 'burn');
      expect(burnStatuses.length).toBe(2);
    });

    it('应该限制叠加层数', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'burn',
        source: {
          sourceType: 'skill',
          sourceName: '火球术',
          casterSnapshot: {
            casterId: 'caster',
            casterName: '施法者',
            attributes: mockTarget.baseAttributes,
          },
        },
      };

      // 添加3次(burn最大叠加3层)
      container.addStatus(request, mockTarget);
      container.addStatus(request, mockTarget);
      container.addStatus(request, mockTarget);

      // 第4次应该失败
      const result = container.addStatus(request, mockTarget);
      expect(result.success).toBe(false);
      expect(result.message).toContain('最大叠加层数');
    });
  });

  describe('tickStatuses', () => {
    it('应该递减turn类型状态的时长', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'armor_up',
        source: { sourceType: 'skill', sourceName: '护体术' },
      };

      container.addStatus(request, mockTarget);

      const context: TickContext = {
        currentTurn: 1,
        currentTime: Date.now(),
        unitSnapshot: mockTarget,
      };

      const result1 = container.tickStatuses(context);
      expect(result1.expiredStatuses.length).toBe(0);

      const result2 = container.tickStatuses(context);
      expect(result2.expiredStatuses.length).toBe(1);
      expect(container.hasStatus('armor_up')).toBe(false);
    });

    it('应该计算DOT伤害', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'burn',
        source: {
          sourceType: 'skill',
          sourceName: '火球术',
          casterSnapshot: {
            casterId: 'caster',
            casterName: '施法者',
            attributes: mockTarget.baseAttributes,
            elementMultipliers: { 火: 1.5 },
          },
        },
      };

      container.addStatus(request, mockTarget);

      const context: TickContext = {
        currentTurn: 1,
        currentTime: Date.now(),
        unitSnapshot: mockTarget,
      };

      const result = container.tickStatuses(context);
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.effectLogs.length).toBeGreaterThan(0);
      expect(result.effectLogs[0]).toContain('灼烧');
    });
  });

  describe('calculateAttributeModifications', () => {
    it('应该正确计算属性修正', () => {
      const request1: StatusApplicationRequest = {
        statusKey: 'armor_up',
        source: { sourceType: 'skill', sourceName: '护体术' },
      };
      const request2: StatusApplicationRequest = {
        statusKey: 'speed_up',
        source: { sourceType: 'skill', sourceName: '疾行术' },
      };

      container.addStatus(request1, mockTarget);
      container.addStatus(request2, mockTarget);

      const modifications = container.calculateAttributeModifications({
        target: mockTarget,
      });

      expect(modifications.vitality).toBeGreaterThan(0); // armor_up增加
      expect(modifications.speed).toBe(20); // speed_up固定+20
    });
  });

  describe('clearStatusesByType', () => {
    it('应该清除指定类型的状态', () => {
      container.addStatus(
        {
          statusKey: 'armor_up',
          source: { sourceType: 'skill', sourceName: 'test' },
        },
        mockTarget,
      );
      container.addStatus(
        {
          statusKey: 'burn',
          source: {
            sourceType: 'skill',
            sourceName: 'test',
            casterSnapshot: {
              casterId: 'test',
              casterName: 'test',
              attributes: mockTarget.baseAttributes,
            },
          },
        },
        mockTarget,
      );

      const count = container.clearStatusesByType('buff');
      expect(count).toBe(1);
      expect(container.hasStatus('armor_up')).toBe(false);
      expect(container.hasStatus('burn')).toBe(true);
    });
  });

  describe('toJSON/fromJSON', () => {
    it('应该正确序列化和反序列化状态', () => {
      const request: StatusApplicationRequest = {
        statusKey: 'armor_up',
        source: { sourceType: 'skill', sourceName: '护体术' },
      };

      container.addStatus(request, mockTarget);
      const json = container.toJSON();

      const newContainer = new StatusContainer();
      newContainer.fromJSON(json);

      expect(newContainer.hasStatus('armor_up')).toBe(true);
      expect(newContainer.getActiveStatuses().length).toBe(1);
    });
  });
});
