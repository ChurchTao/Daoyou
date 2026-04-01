import { CreationEventBus } from '../../core/EventBus';
import { CreationEventPriorityLevel } from '../../core/types';

describe('CreationEventBus', () => {
  it('应按优先级顺序执行订阅者', () => {
    const bus = new CreationEventBus();
    const calls: string[] = [];

    bus.subscribe(
      'MaterialSubmittedEvent',
      () => calls.push('audit'),
      CreationEventPriorityLevel.AUDIT,
    );
    bus.subscribe(
      'MaterialSubmittedEvent',
      () => calls.push('analysis'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );
    bus.subscribe('MaterialSubmittedEvent', () => calls.push('default'));

    bus.publish({
      type: 'MaterialSubmittedEvent',
      sessionId: 'session-1',
      timestamp: Date.now(),
    });

    expect(calls).toEqual(['analysis', 'audit', 'default']);
  });

  it('应记录事件历史', () => {
    const bus = new CreationEventBus();

    bus.publish({
      type: 'MaterialSubmittedEvent',
      sessionId: 'session-2',
      timestamp: Date.now(),
    });

    expect(bus.getEventHistory()).toHaveLength(1);
    expect(bus.getEventHistory()[0].sessionId).toBe('session-2');
  });
});