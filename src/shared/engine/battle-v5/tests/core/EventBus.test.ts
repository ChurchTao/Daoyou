import { describe, expect, it, beforeEach } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { CombatEvent } from '../../core/types';

interface TestEvent extends CombatEvent {
  type: 'TestEvent';
}

describe('EventBus', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('does not dispatch to subscribers added during the current publish', () => {
    const calls: string[] = [];

    EventBus.instance.subscribe<TestEvent>('TestEvent', () => {
      calls.push('first');
      EventBus.instance.subscribe<TestEvent>('TestEvent', () => {
        calls.push('second');
      });
    });

    EventBus.instance.publish<TestEvent>({
      type: 'TestEvent',
      timestamp: Date.now(),
    });
    expect(calls).toEqual(['first']);

    EventBus.instance.publish<TestEvent>({
      type: 'TestEvent',
      timestamp: Date.now(),
    });
    expect(calls).toEqual(['first', 'first', 'second']);
  });
});
