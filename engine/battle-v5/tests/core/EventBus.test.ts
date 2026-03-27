/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventBus } from '../../core/EventBus';
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { DamageSystem } from '../../systems/DamageSystem';
import { CombatLogSystem } from '../../systems/log/CombatLogSystem';
import { Unit } from '../../units/Unit';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = EventBus.instance;
      const instance2 = EventBus.instance;
      expect(instance1).toBe(instance2);
    });
  });

  describe('订阅和发布', () => {
    it('应该能够订阅和发布事件', () => {
      let received = false;
      const handler = () => {
        received = true;
      };

      eventBus.subscribe('TestEvent', handler);
      eventBus.publish({
        type: 'TestEvent',
        priority: 50,
        timestamp: Date.now(),
      });

      expect(received).toBe(true);
    });

    it('应该按优先级顺序处理事件', () => {
      const order: number[] = [];
      const handler1 = () => order.push(1);
      const handler2 = () => order.push(2);
      const handler3 = () => order.push(3);

      eventBus.subscribe('TestEvent', handler1, 10);
      eventBus.subscribe('TestEvent', handler2, 30);
      eventBus.subscribe('TestEvent', handler3, 20);

      eventBus.publish({
        type: 'TestEvent',
        priority: 0,
        timestamp: Date.now(),
      });

      expect(order).toEqual([2, 3, 1]);
    });
  });

  describe('取消订阅', () => {
    it('应该能够取消订阅', () => {
      let count = 0;
      const handler = () => {
        count++;
      };

      eventBus.subscribe('TestEvent', handler);
      eventBus.publish({
        type: 'TestEvent',
        priority: 0,
        timestamp: Date.now(),
      });
      expect(count).toBe(1);

      eventBus.unsubscribe('TestEvent', handler);
      eventBus.publish({
        type: 'TestEvent',
        priority: 0,
        timestamp: Date.now(),
      });
      expect(count).toBe(1);
    });
  });

  describe('事件历史', () => {
    it('应该记录事件历史', () => {
      eventBus.publish({ type: 'Event1', priority: 0, timestamp: Date.now() });
      eventBus.publish({ type: 'Event2', priority: 0, timestamp: Date.now() });

      const history = eventBus.getEventHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe('Event1');
      expect(history[1].type).toBe('Event2');
    });

    it('应该限制历史大小', () => {
      for (let i = 0; i < 1500; i++) {
        eventBus.publish({
          type: `Event${i}`,
          priority: 0,
          timestamp: Date.now(),
        });
      }

      const history = eventBus.getEventHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('EventBus 清理', () => {
    it('ActionExecutionSystem 应该正确取消订阅', () => {
      const system = new ActionExecutionSystem();
      const subscribers = (eventBus as any)._subscribers;

      // Verify subscription exists
      expect(subscribers.has('SkillPreCastEvent')).toBe(true);

      // Destroy system
      system.destroy();

      // Either the key should be removed or the array should be empty
      const afterSubscribers = subscribers.get('SkillPreCastEvent');
      const hasKey = subscribers.has('SkillPreCastEvent');
      const count = afterSubscribers ? afterSubscribers.length : 0;
      expect(hasKey && count > 0).toBe(false);
    });

    it('DamageSystem 应该正确取消订阅', () => {
      const system = new DamageSystem();
      const subscribers = (eventBus as any)._subscribers;

      // Verify subscription exists
      expect(subscribers.has('SkillCastEvent')).toBe(true);

      // Destroy system
      system.destroy();

      // Either the key should be removed or the array should be empty
      const afterSubscribers = subscribers.get('SkillCastEvent');
      const hasKey = subscribers.has('SkillCastEvent');
      const count = afterSubscribers ? afterSubscribers.length : 0;
      expect(hasKey && count > 0).toBe(false);
    });

    it('CombatLogSystem 应该正确取消订阅所有事件', () => {
      const system = new CombatLogSystem();
      system.subscribe(eventBus); // 显式订阅
      const subscribers = (eventBus as any)._subscribers;

      // Verify all subscriptions exist (新的日志系统订阅的事件)
      expect(subscribers.has('SkillCastEvent')).toBe(true);
      expect(subscribers.has('HitCheckEvent')).toBe(true);
      expect(subscribers.has('DamageTakenEvent')).toBe(true);
      expect(subscribers.has('HealEvent')).toBe(true);

      // Destroy system
      system.destroy();

      // Verify all subscriptions are removed or empty
      for (const eventType of ['SkillCastEvent', 'HitCheckEvent', 'DamageTakenEvent', 'HealEvent']) {
        const afterSubscribers = subscribers.get(eventType);
        const hasKey = subscribers.has(eventType);
        const count = afterSubscribers ? afterSubscribers.length : 0;
        expect(hasKey && count > 0).toBe(false);
      }
    });

    it('AbilityContainer 应该正确取消订阅', () => {
      const unit = new Unit('test-unit', 'Test Unit', {});
      const subscribers = (eventBus as any)._subscribers;

      // Verify subscription exists
      expect(subscribers.has('ActionEvent')).toBe(true);

      // Destroy container
      unit.abilities.destroy();

      // Either the key should be removed or the array should be empty
      const afterSubscribers = subscribers.get('ActionEvent');
      const hasKey = subscribers.has('ActionEvent');
      const count = afterSubscribers ? afterSubscribers.length : 0;
      expect(hasKey && count > 0).toBe(false);
    });

    it('多次销毁不应该抛出错误', () => {
      const system = new ActionExecutionSystem();

      // Should not throw
      expect(() => {
        system.destroy();
        system.destroy();
      }).not.toThrow();
    });

    it('销毁后 handlers Map 应该为空', () => {
      const actionSystem = new ActionExecutionSystem();
      const damageSystem = new DamageSystem();
      const logSystem = new CombatLogSystem();
      logSystem.subscribe(eventBus); // 新增：显式订阅

      // Destroy all systems
      actionSystem.destroy();
      damageSystem.destroy();
      logSystem.destroy();

      // Verify handlers are cleared
      expect((actionSystem as any)._handlers.size).toBe(0);
      expect((damageSystem as any)._handlers.size).toBe(0);
      expect((logSystem as any).handlers.size).toBe(0);
    });
  });
});
