import { describe, expect, it } from 'vitest';
import { createHitResolution, withDamageSegment } from '../../core/resolution';
import { exportBattleRuntimeState, setRuntimeRound, restoreBattleRuntimeState } from '../../core/runtimeState';
import { AttributeType } from '../../core/types';
import { TriggerLedger } from '../../core/triggerLedger';
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

function event(resolution: ReturnType<typeof withDamageSegment>) {
  return { type: 'DamageSegmentAppliedEvent', timestamp: 0, resolution };
}

describe('trigger ledger', () => {
  it('claims each multi-hit segment according to configured granularity', () => {
    const owner = unit('owner');
    const target = unit('target');
    const ledger = new TriggerLedger();
    const hit = createHitResolution({ actionId: 'a1', castId: 'c1', caster: owner, target });
    const first = withDamageSegment(hit, 0, 2);
    const second = withDamageSegment(hit, 1, 2);

    expect(ledger.claim(owner, event(first), 'segment', { maxTriggers: 2, granularity: 'segment' })).toBe(true);
    expect(ledger.claim(owner, event(second), 'segment', { maxTriggers: 2, granularity: 'segment' })).toBe(true);
    expect(ledger.claim(owner, event(first), 'hit', { maxTriggers: 1, granularity: 'hit' })).toBe(true);
    expect(ledger.claim(owner, event(second), 'hit', { maxTriggers: 1, granularity: 'hit' })).toBe(false);
    expect(ledger.claim(owner, event(first), 'cast', { maxTriggers: 1, granularity: 'cast' })).toBe(true);
    expect(ledger.claim(owner, event(second), 'cast', { maxTriggers: 1, granularity: 'cast' })).toBe(false);
  });

  it('shares a claim group and restores round state through checkpoints', () => {
    const owner = unit('owner');
    const target = unit('target');
    const ledger = new TriggerLedger();
    const hit = createHitResolution({ actionId: 'a1', castId: 'c1', caster: owner, target });
    const damage = event(withDamageSegment(hit, 0, 1));
    const policy = { maxTriggers: 1, granularity: 'round' as const, group: 'guard' };

    setRuntimeRound(owner, 3);
    expect(ledger.claim(owner, damage, 'first', policy)).toBe(true);
    expect(ledger.claim(owner, damage, 'second', policy)).toBe(false);
    const snapshot = exportBattleRuntimeState(owner);
    const restored = unit('restored');
    restoreBattleRuntimeState(restored, snapshot);
    expect(ledger.claim(restored, damage, 'second', policy)).toBe(false);
    setRuntimeRound(owner, 4);
    expect(ledger.claim(owner, damage, 'second', policy)).toBe(true);
  });
});
