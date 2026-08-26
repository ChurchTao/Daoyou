import { describe, expect, it } from 'vitest';
import { AttributeType } from '../../core/types';
import {
  createHitResolution,
  nextDamageSegment,
  withDamageSegment,
} from '../../core/resolution';
import { Unit } from '../../units/Unit';

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.STRENGTH]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.ENDURANCE]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

describe('combat resolution identity', () => {
  it('keeps cast identity stable while assigning distinct hit identities', () => {
    const caster = unit('caster');
    const target = unit('target');
    const first = createHitResolution({
      actionId: 'action:1',
      castId: 'cast:1',
      caster,
      target,
      hitIndex: 1,
    });
    const second = createHitResolution({
      actionId: 'action:1',
      castId: 'cast:1',
      caster,
      target,
    });

    expect(first.actionId).toBe(second.actionId);
    expect(first.castId).toBe(second.castId);
    expect(first.hitId).not.toBe(second.hitId);
  });

  it('validates and annotates damage segments without changing hit identity', () => {
    const context = createHitResolution({
      actionId: 'action:1',
      castId: 'cast:1',
      caster: unit('caster'),
      target: unit('target'),
    });
    const segment = withDamageSegment(context, 1, 3);

    expect(segment.hitId).toBe(context.hitId);
    expect(segment.segmentIndex).toBe(1);
    expect(segment.segmentCount).toBe(3);
    expect(() => withDamageSegment(context, -1)).toThrow();
    expect(() => withDamageSegment(context, 3, 3)).toThrow();
  });

  it('allocates monotonically increasing segment indexes for one hit', () => {
    const context = createHitResolution({
      actionId: 'action:segments',
      castId: 'cast:segments',
      caster: unit('caster-segments'),
      target: unit('target-segments'),
    });

    const first = nextDamageSegment(context);
    const second = nextDamageSegment(context);
    expect(first.segmentIndex).toBe(0);
    expect(second.segmentIndex).toBe(1);
    expect(first.hitId).toBe(second.hitId);
  });
});
