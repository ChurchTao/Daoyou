import { Ability } from '../../abilities/Ability';
import { AbilityType } from '../../core/types';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';
import { EventBus } from '../../core/EventBus';

describe('Ability', () => {
  let unit: Unit;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.SPIRIT]: 50,
    });
  });

  describe('基础功能', () => {
    it('应该正确初始化能力', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      expect(ability.id).toBe('test_ability');
      expect(ability.name).toBe('测试能力');
      expect(ability.type).toBe(AbilityType.ACTIVE_SKILL);
      expect(ability.isActive()).toBe(false);
    });

    it('应该支持激活和停用', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      ability.setOwner(unit);
      ability.setActive(true);
      expect(ability.isActive()).toBe(true);

      ability.setActive(false);
      expect(ability.isActive()).toBe(false);
    });
  });

  describe('事件订阅', () => {
    it('激活时应该订阅事件', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.PASSIVE_SKILL);
      ability.setOwner(unit);

      let eventReceived = false;
      ability.onActivate = () => {
        eventReceived = true;
      };

      ability.setActive(true);
      expect(eventReceived).toBe(true);
    });

    it('停用时应该取消订阅事件', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.PASSIVE_SKILL);
      ability.setOwner(unit);

      let deactivated = false;
      ability.onDeactivate = () => {
        deactivated = true;
      };

      ability.setActive(true);
      ability.setActive(false);
      expect(deactivated).toBe(true);
    });
  });

  describe('触发条件检查', () => {
    it('默认情况下总是可以触发', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      expect(ability.canTrigger(undefined as any)).toBe(true);
    });
  });

  describe('冷却管理', () => {
    it('应该支持冷却时间', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      ability.setCooldown(3);
      expect(ability.getCurrentCooldown()).toBe(0);

      ability.startCooldown();
      expect(ability.getCurrentCooldown()).toBe(3);

      ability.tickCooldown();
      expect(ability.getCurrentCooldown()).toBe(2);

      ability.tickCooldown();
      ability.tickCooldown();
      expect(ability.getCurrentCooldown()).toBe(0);
      expect(ability.isReady()).toBe(true);
    });
  });
});
