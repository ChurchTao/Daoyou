import { describe, expect, it } from 'vitest';
import { createBattle, type BattleState, type CreateBattleInput } from './core';
import { daoyouRulesetV5 } from './rules-daoyou';
import { COMBAT_V6_PHASE_7D_VERSIONS } from './version';

describe('authoritative action observation', () => {
  it('captures 4v4 with one pet each without changing events, RNG or the result', () => {
    const input: CreateBattleInput = {
      seed: 42,
      versions: COMBAT_V6_PHASE_7D_VERSIONS,
      ruleset: daoyouRulesetV5,
      units: [0, 1].flatMap((side) =>
        Array.from({ length: 4 }, (_, slot) => [
          {
            id: `${side}-${slot}`,
            name: '人物',
            side: side as 0 | 1,
            slot,
            kind: 'player' as const,
            attrs: {
              hp: 1000,
              maxHp: 1000,
              speed: 100 - slot,
              physicalAtk: 80,
              physicalDef: 20,
            },
          },
          {
            id: `${side}-${slot}-pet`,
            ownerId: `${side}-${slot}`,
            name: '灵兽',
            side: side as 0 | 1,
            slot: slot + 4,
            kind: 'pet' as const,
            attrs: {
              hp: 1000,
              maxHp: 1000,
              speed: 80 - slot,
              physicalAtk: 60,
              physicalDef: 20,
            },
          },
        ]).flat(),
      ),
    };
    const observed = createBattle(input),
      baseline = createBattle(input);
    const frames: Array<{ state: BattleState; seq: number }> = [];
    baseline.lockAndResolve();
    observed.lockAndResolve((state, seq) => frames.push({ state, seq }));
    expect(frames).toHaveLength(16);
    expect(frames.every((f) => f.state.units.length === 16)).toBe(true);
    expect(frames.map((f) => f.seq)).toEqual(
      [...new Set(frames.map((f) => f.seq))].sort((a, b) => a - b),
    );
    for (const frame of frames) {
      const damage = observed
        .log()
        .slice(0, frame.seq + 1)
        .filter((e) => e.type === 'damage')
        .at(-1);
      if (damage?.type === 'damage')
        expect(
          frame.state.units.find((u) => u.id === damage.targetId)?.attrs.hp,
        ).toBe(damage.hpAfter);
    }
    expect(observed.log()).toEqual(baseline.log());
    expect(observed.snapshot()).toEqual(baseline.snapshot());
    frames[0].state.units[0].attrs.hp = -999;
    expect(observed.snapshot()).toEqual(baseline.snapshot());
    expect(frames.at(-1)?.state.units[0].attrs.hp).not.toBe(-999);
  });
});
