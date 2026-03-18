import { EventBus } from '../../core/EventBus';

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
});
