import { describe, expect, it } from 'vitest';
import type { CombatV6TrainingUnitViewV1 as Unit } from '../contracts/combatV6';
import { applyUnitDelta, contiguousEvents, diffUnits } from './playback';
import { combatV6Playback, combatV6Units } from './presentation';
import {
  presentationBattle,
  presentationScenarios,
} from './presentation-fixtures';
const unit = (id: string): Unit => ({
  id,
  name: id,
  side: 0,
  slot: 0,
  hp: 100,
  maxHp: 100,
  mp: 30,
  maxMp: 30,
  wound: 0,
  downed: false,
  dead: false,
  escaped: false,
  statuses: [],
  barriers: [],
  resources: [],
});
describe('combat display deltas', () => {
  it.each(presentationScenarios)(
    'reconstructs every authoritative action and round end: %s',
    (scenario) => {
      const { battle, input } = presentationBattle(scenario);
      const start = battle.snapshot();
      const collector = combatV6Playback(
        battle.log().length - 1,
        input.statusDefs ?? [],
        start,
      );
      let shown = combatV6Units(start, input.statusDefs ?? []);
      let cursor = battle.log().length - 1;
      const capture: typeof collector.capture = (state, seq) => {
        collector.capture(state, seq);
        const frame = collector.playback.frames.at(-1)!;
        if (seq <= cursor) return;
        expect(frame.afterEventSeq).toBe(seq);
        shown = applyUnitDelta(shown, JSON.parse(JSON.stringify(frame)));
        expect(shown).toEqual(combatV6Units(state, input.statusDefs ?? []));
        cursor = seq;
      };
      battle.lockAndResolve(capture);
      capture(battle.snapshot(), battle.log().length - 1);
      expect(shown).toEqual(
        combatV6Units(battle.snapshot(), input.statusDefs ?? []),
      );
      const count = collector.playback.frames.length;
      capture(battle.snapshot(), cursor);
      expect(collector.playback.frames).toHaveLength(count);
    },
  );
  it('replaces absolute values and arrays, including zeros and clears, without touching other units', () => {
    const before = [
      {
        ...unit('a'),
        ownerId: 'b',
        attributes: { speed: 10 },
        statuses: [{ id: 'seal', remainingRounds: 1, stacks: 1 }],
        barriers: [
          { id: 'shield', name: '盾', current: 50, remainingRounds: 1 },
        ],
        resources: [{ id: 'rage', name: '战意', current: 20, max: 100 }],
      },
      unit('b'),
    ];
    const after: Unit[] = [
      { ...unit('a'), hp: 0, mp: 0, wound: 20, downed: true },
      before[1],
    ];
    const delta = diffUnits(before, after, 10, 2);
    expect(JSON.parse(JSON.stringify(delta)).updates[0].set).toMatchObject({
      hp: 0,
      mp: 0,
      statuses: [],
      barriers: [],
      resources: [],
    });
    const restored = applyUnitDelta(before, JSON.parse(JSON.stringify(delta)));
    expect(restored).toEqual(after);
    expect(restored[1]).toBe(before[1]);
    expect(before[0].hp).toBe(100);
    const revived = [{ ...after[0], hp: 50, downed: false }, after[1]];
    expect(
      applyUnitDelta(restored, diffUnits(restored, revived, 11, 2)),
    ).toEqual(revived);
  });
  it('keeps empty action frames and handles simultaneous changes, appearance and removal', () => {
    const before = [unit('a'), unit('b')];
    const unchanged = diffUnits(before, structuredClone(before), 3, 1);
    expect(unchanged.updates).toEqual([]);
    expect(applyUnitDelta(before, unchanged)).toBe(before);
    const after = [
      { ...before[0], hp: 25 },
      { ...before[1], hp: 40 },
      { ...unit('pet'), ownerId: 'a', kind: 'pet' as const },
    ];
    const changed = applyUnitDelta(before, diffUnits(before, after, 4, 1));
    expect(changed).toEqual(after);
    expect(
      applyUnitDelta(changed, diffUnits(changed, [after[0]], 5, 1)),
    ).toEqual([after[0]]);
  });
  it('rejects missing baselines and duplicate unit operations', () => {
    expect(() =>
      applyUnitDelta([], {
        afterEventSeq: 2,
        round: 1,
        updates: [{ id: 'a', set: { hp: 1 } }],
      }),
    ).toThrow();
    expect(() =>
      applyUnitDelta([unit('a')], {
        afterEventSeq: 2,
        round: 1,
        updates: [],
        added: [unit('a')],
      }),
    ).toThrow();
    expect(() =>
      applyUnitDelta([unit('a')], {
        afterEventSeq: 2,
        round: 1,
        updates: [],
        removed: ['a', 'a'],
      }),
    ).toThrow();
  });
  it('preserves authoritative order when a benched pet appears between existing units', () => {
    const before = [unit('a'), unit('b')];
    const after = [before[0], { ...unit('pet'), ownerId: 'a' }, before[1]];
    expect(applyUnitDelta(before, diffUnits(before, after, 2, 1))).toEqual(
      after,
    );
  });
  it('requires continuous event cursors, rejects duplicates and gaps', () => {
    expect(contiguousEvents([{ seq: 4 }, { seq: 5 }], 3, 5)).toBe(true);
    expect(contiguousEvents([{ seq: 4 }, { seq: 4 }], 3, 5)).toBe(false);
    expect(contiguousEvents([{ seq: 5 }], 3, 5)).toBe(false);
    expect(contiguousEvents([], 5, 5)).toBe(true);
  });
});
