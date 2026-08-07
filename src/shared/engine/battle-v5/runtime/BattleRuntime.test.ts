import { describe, expect, it } from 'vitest';
import type { HpChangedEvent } from '../core/events';
import { AttributeType } from '../core/types';
import { Unit } from '../units/Unit';
import { BattleRuntime } from './BattleRuntime';

function createUnit(id: string, runtime: BattleRuntime): Unit {
  return new Unit(
    id,
    id,
    {
      [AttributeType.VITALITY]: 10,
    },
    { runtime },
  );
}

describe('BattleRuntime isolation', () => {
  it('does not leak subscribers, event history or trace counters', () => {
    const left = new BattleRuntime();
    const right = new BattleRuntime();
    const leftUnit = createUnit('left', left);
    const rightUnit = createUnit('right', right);
    const observed: string[] = [];

    left.events.subscribe<HpChangedEvent>('HpChangedEvent', (event) => {
      observed.push(event.unit.id);
    });

    rightUnit.takeDamage(1);
    leftUnit.takeDamage(1);

    expect(observed).toEqual(['left']);
    expect(left.events.getEventHistory()).toHaveLength(1);
    expect(right.events.getEventHistory()).toHaveLength(1);
    expect(left.events.getEventHistory()[0]?.trace?.eventId).toBe(
      'event_v3_1',
    );
    expect(right.events.getEventHistory()[0]?.trace?.eventId).toBe(
      'event_v3_1',
    );
  });

  it('advances seeded random state independently and can restore it', () => {
    const left = new BattleRuntime();
    const right = new BattleRuntime();

    const first = left.random.next();
    expect(right.random.next()).toBe(first);

    const restorable = left.random;
    if (!('exportState' in restorable) || !('restoreState' in restorable)) {
      throw new Error('Default runtime random source must be stateful');
    }
    const snapshot = restorable.exportState();
    const expected = restorable.next();
    restorable.restoreState(snapshot);
    expect(restorable.next()).toBe(expected);
  });
});
