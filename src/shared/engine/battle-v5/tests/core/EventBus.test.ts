import { describe, expect, it, beforeEach } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { createHitResolution } from '../../core/resolution';
import { CombatEvent } from '../../core/types';
import { Unit } from '../../units/Unit';

interface TestEvent extends CombatEvent {
  type: 'TestEvent';
}

interface NestedEvent extends CombatEvent {
  type: 'NestedEvent';
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

  it('propagates resolution identity to nested causal events', () => {
    const caster = new Unit('caster', 'caster', {});
    const target = new Unit('target', 'target', {});
    const resolution = createHitResolution({
      actionId: 'action:1',
      castId: 'cast:1',
      caster,
      target,
    });
    let nested: NestedEvent | undefined;

    EventBus.instance.subscribe<TestEvent>('TestEvent', () => {
      EventBus.instance.publish<NestedEvent>({
        type: 'NestedEvent',
        timestamp: Date.now(),
      });
    });
    EventBus.instance.subscribe<NestedEvent>('NestedEvent', (event) => {
      nested = event;
    });

    EventBus.instance.publish<TestEvent>({
      type: 'TestEvent',
      timestamp: Date.now(),
      resolution,
    });

    expect(nested?.resolution).toBe(resolution);
  });
});
