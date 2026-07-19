import { describe, expect, it } from 'vitest';
import {
  createSweepGameState,
  simulateSweepTrace,
  SWEEP_LEAF_COUNT,
  type SweepInputSegment,
} from './SweepGameRules';

function lawnmowerTrace(): SweepInputSegment[] {
  const trace: SweepInputSegment[] = [
    { ticks: 48, direction: 6, sweeping: true },
  ];
  for (let row = 0; row < 5; row += 1) {
    trace.push({ ticks: 12, direction: 0, sweeping: true });
    trace.push({ ticks: 104, direction: row % 2 === 0 ? 2 : 6, sweeping: true });
  }
  return trace;
}

describe('SweepGameRules', () => {
  it('generates the same eighteen leaves for the same seed', () => {
    const left = createSweepGameState('sect:date:session');
    const right = createSweepGameState('sect:date:session');
    expect(left.leaves).toHaveLength(SWEEP_LEAF_COUNT);
    expect(right.leaves).toEqual(left.leaves);
  });

  it('replays a valid compressed input trace to a successful result', () => {
    const result = simulateSweepTrace('sweep-success', lawnmowerTrace());
    expect(result.success).toBe(true);
    expect(result.state.cleared).toBe(SWEEP_LEAF_COUNT);
  });

  it('rejects malformed directions and oversized traces', () => {
    expect(
      simulateSweepTrace('invalid', [
        { ticks: 1, direction: 8, sweeping: false },
      ]).reason,
    ).toBe('invalid_trace');
    expect(
      simulateSweepTrace(
        'oversized',
        Array.from({ length: 601 }, () => ({
          ticks: 1,
          direction: null,
          sweeping: false,
        })),
      ).reason,
    ).toBe('too_many_segments');
  });

  it('does not accept a trace that leaves debris behind', () => {
    const result = simulateSweepTrace('incomplete', [
      { ticks: 10, direction: 0, sweeping: false },
    ]);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('leaves_remaining');
  });
});
