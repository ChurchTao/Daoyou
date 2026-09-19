import { describe, expect, it } from 'vitest';
import type { CombatV6DisplayEvent } from '../contracts/combatV6';
import {
  appendBattleEntries,
  compactLogLines,
  frameFeedback,
} from './battle-log';

const view = {
  units: [],
  display: {
    skills: {},
    statuses: { seal: '封术' },
    unitNames: { a: '甲', b: '乙', c: '丙' },
  },
};
const empty = { entries: [], round: 0, open: false, seq: -1 };
const events = (input: CombatV6DisplayEvent[], start = 0) =>
  input.map((event, i) => ({ seq: start + i, event }));
const damage = (targetId: string, amount: number): CombatV6DisplayEvent => ({
  type: 'damage',
  sourceId: 'a',
  targetId,
  amount,
  hpAfter: 20,
  kind: 'physical',
});

describe('battle log presentation', () => {
  it('does not combine damage from different sources', () => {
    const log = appendBattleEntries(empty, events([
      { type: 'actionStart', unitId: 'a', command: { type: 'attack', target: 'b' } },
      damage('b', 10),
      { ...damage('b', 11), sourceId: 'c' } as CombatV6DisplayEvent,
    ]), view);
    expect(compactLogLines(log.entries[0].lines)).toHaveLength(2);
    expect(log.entries[0].lines[1].text).toContain('来自丙');
  });
  it('preserves critical, protection and knockout boundaries while compacting adjacent hits', () => {
    const log = appendBattleEntries(
      empty,
      events([
        { type: 'roundStart', round: 1 },
        {
          type: 'actionStart',
          unitId: 'a',
          command: { type: 'attack', target: 'b' },
        },
        damage('b', 10),
        damage('b', 11),
        { type: 'protectTrigger', protectorId: 'c', originalTargetId: 'b' },
        damage('c', 7),
        {
          type: 'hit',
          sourceId: 'a',
          targetId: 'b',
          kind: 'physical',
          crit: true,
          fury: true,
        },
        damage('b', 25),
        { type: 'unitDowned', unitId: 'b' },
      ]),
      view,
    );
    const lines = compactLogLines(log.entries[0].lines);
    expect(lines[0].text).toBe('乙受到 2 段物理伤害，共 21 点');
    expect(lines.map((l) => l.text)).toEqual(
      expect.arrayContaining(['丙挺身保护乙', '乙受到暴击 · 狂暴', '乙倒地']),
    );
    expect(
      lines.filter((l) => l.amount !== undefined).map((l) => l.amount),
    ).toEqual([21, 7, 25]);
    expect(log.entries[0].lines).toHaveLength(7);
    expect(frameFeedback(log.entries, 3)?.targets.map((t) => t.id)).toEqual([
      'b',
      'b',
    ]);
  });
  it('retains detailed shield and removal causes and appends without changing old entries', () => {
    const before = appendBattleEntries(
      empty,
      events([
        { type: 'actionStart', unitId: 'a', command: { type: 'defend' } },
      ]),
      view,
    );
    const after = appendBattleEntries(
      before,
      events(
        [
          {
            type: 'barrierChanged',
            sourceId: 'a',
            unitId: 'a',
            barrierId: 'shield',
            before: 50,
            after: 20,
            reason: 'absorbed',
          },
          {
            type: 'statusRemoved',
            unitId: 'b',
            statusId: 'seal',
            reason: 'dispel',
          },
          {
            type: 'statusRemoved',
            unitId: 'b',
            statusId: 'seal',
            reason: 'expired',
          },
        ],
        1,
      ),
      view,
    );
    expect(before.entries[0].lines).toHaveLength(0);
    expect(after.entries[0].lines.map((l) => l.text)).toEqual([
      '甲护盾吸收伤害 · 护盾 50 → 20',
      '乙的「封术」被驱散',
      '乙的「封术」到期',
    ]);
    expect(after.entries[0].lines[2].detail).toBe(true);
  });
});
