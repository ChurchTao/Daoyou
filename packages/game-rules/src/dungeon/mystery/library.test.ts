import { describe, expect, it } from 'vitest';
import {
  decideMysteryRestock,
  MYSTERY_LIBRARY_POLICY,
  needsMysteryRestock,
  pickMysteryScenario,
  shouldRetireMysteryScenario,
  type LibraryPlay,
  type LibraryScenario,
} from './library.js';

const first = () => 0;
const scenario = (
  id: string,
  templateId: string,
  playCount = 0,
): LibraryScenario => ({
  id,
  templateId,
  playCount,
});
const play = (
  scenarioId: string,
  templateId: string,
  lastPlayedAt: number,
  completed = true,
): LibraryPlay => ({ scenarioId, templateId, lastPlayedAt, completed });

describe('pickMysteryScenario', () => {
  it('prefers an unplayed scenario with the fewest global plays', () => {
    const pick = pickMysteryScenario({
      templateIds: ['murder'],
      scenarios: [
        scenario('a', 'murder', 9),
        scenario('b', 'murder', 2),
        scenario('c', 'murder', 5),
      ],
      plays: [],
      random: first,
    });
    expect(pick).toEqual({
      kind: 'scenario',
      templateId: 'murder',
      scenarioId: 'b',
      replay: false,
      firstPlay: true,
      unplayedLeft: 2,
    });
  });

  it('rotates to the template the player has played least', () => {
    const pick = pickMysteryScenario({
      templateIds: ['murder', 'seal'],
      scenarios: [
        scenario('a', 'murder'),
        scenario('b', 'murder'),
        scenario('s', 'seal'),
      ],
      plays: [play('a', 'murder', 1)],
      random: first,
    });
    expect(pick).toMatchObject({ templateId: 'seal', scenarioId: 's' });
  });

  it('falls back to the longest-unplayed old scenario and marks completed ones as replay', () => {
    const scenarios = [scenario('a', 'murder'), scenario('b', 'murder')];
    expect(
      pickMysteryScenario({
        templateIds: ['murder'],
        scenarios,
        plays: [play('a', 'murder', 200), play('b', 'murder', 100)],
        random: first,
      }),
    ).toEqual({
      kind: 'scenario',
      templateId: 'murder',
      scenarioId: 'b',
      replay: true,
      firstPlay: false,
      unplayedLeft: 0,
    });
    // 中途离开、没看过真相的本再次遇到不算重温。
    expect(
      pickMysteryScenario({
        templateIds: ['murder'],
        scenarios,
        plays: [play('a', 'murder', 200), play('b', 'murder', 100, false)],
        random: first,
      }),
    ).toMatchObject({ scenarioId: 'b', replay: false, firstPlay: false });
  });

  it('reports a cold start when no slot has any scenario', () => {
    expect(
      pickMysteryScenario({
        templateIds: ['murder', 'seal'],
        scenarios: [],
        plays: [],
        random: first,
      }),
    ).toEqual({ kind: 'empty', templateId: 'murder' });
  });
});

describe('needsMysteryRestock', () => {
  it('restocks when the player is about to run out, has run out, or the slot is empty', () => {
    const base = {
      kind: 'scenario',
      templateId: 'm',
      scenarioId: 'x',
      replay: false,
      firstPlay: true,
    } as const;
    expect(needsMysteryRestock({ ...base, unplayedLeft: 2 })).toBe(false);
    expect(needsMysteryRestock({ ...base, unplayedLeft: 1 })).toBe(true);
    expect(
      needsMysteryRestock({
        ...base,
        unplayedLeft: 0,
        replay: true,
        firstPlay: false,
      }),
    ).toBe(true);
    expect(needsMysteryRestock({ kind: 'empty', templateId: 'm' })).toBe(true);
  });
});

describe('decideMysteryRestock', () => {
  const ok = {
    activeInSlot: 3,
    pendingInSlot: 0,
    pendingTotal: 0,
    lastFailedAt: null,
    now: 1_000_000_000,
  };

  it('enqueues when every gate passes', () => {
    expect(decideMysteryRestock(ok)).toBe('enqueue');
  });

  it('ignores the request once five jobs are pending server-wide', () => {
    expect(
      decideMysteryRestock({
        ...ok,
        pendingTotal: MYSTERY_LIBRARY_POLICY.maxPendingJobs - 1,
      }),
    ).toBe('enqueue');
    expect(
      decideMysteryRestock({
        ...ok,
        pendingTotal: MYSTERY_LIBRARY_POLICY.maxPendingJobs,
      }),
    ).toBe('queue_full');
  });

  it('applies slot capacity, failure backoff and per-slot dedup first', () => {
    expect(decideMysteryRestock({ ...ok, activeInSlot: 30 })).toBe('slot_full');
    expect(decideMysteryRestock({ ...ok, lastFailedAt: ok.now - 60_000 })).toBe(
      'backoff',
    );
    expect(
      decideMysteryRestock({ ...ok, lastFailedAt: ok.now - 31 * 60_000 }),
    ).toBe('enqueue');
    expect(decideMysteryRestock({ ...ok, pendingInSlot: 1 })).toBe(
      'slot_pending',
    );
  });
});

describe('shouldRetireMysteryScenario', () => {
  it('waits for enough plays, then retires low completion or low scores', () => {
    expect(
      shouldRetireMysteryScenario({
        playCount: 19,
        completionCount: 0,
        scoreSum: 0,
      }),
    ).toBe(false);
    expect(
      shouldRetireMysteryScenario({
        playCount: 20,
        completionCount: 3,
        scoreSum: 300,
      }),
    ).toBe(true);
    expect(
      shouldRetireMysteryScenario({
        playCount: 20,
        completionCount: 10,
        scoreSum: 250,
      }),
    ).toBe(true);
    expect(
      shouldRetireMysteryScenario({
        playCount: 20,
        completionCount: 10,
        scoreSum: 700,
      }),
    ).toBe(false);
  });
});
