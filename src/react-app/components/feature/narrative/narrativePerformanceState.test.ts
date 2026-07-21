import { describe, expect, it } from 'vitest';
import {
  advanceNarrativePerformance,
  createNarrativePerformanceState,
  rewindNarrativePerformance,
  shouldAnimateNarrativeAct,
} from './narrativePerformanceState';

describe('narrative performance state', () => {
  it('reveals the current act before advancing', () => {
    const initial = createNarrativePerformanceState();
    const revealed = advanceNarrativePerformance(initial, 3);
    expect(revealed).toEqual({ actIndex: 0, revealed: true });
    expect(advanceNarrativePerformance(revealed, 3)).toEqual({
      actIndex: 1,
      revealed: false,
    });
  });

  it('rewinds to a fully revealed previous act and locks at both ends', () => {
    expect(
      rewindNarrativePerformance({ actIndex: 2, revealed: false }),
    ).toEqual({ actIndex: 1, revealed: true });
    expect(rewindNarrativePerformance(createNarrativePerformanceState())).toEqual(
      createNarrativePerformanceState(),
    );
    expect(
      advanceNarrativePerformance({ actIndex: 2, revealed: true }, 3),
    ).toEqual({ actIndex: 2, revealed: true });
  });

  it('starts a switched script from its opening act', () => {
    expect(createNarrativePerformanceState()).toEqual({
      actIndex: 0,
      revealed: false,
    });
  });

  it('shows complete copy without animation when motion is reduced', () => {
    expect(shouldAnimateNarrativeAct(true, false)).toBe(false);
    expect(shouldAnimateNarrativeAct(false, true)).toBe(false);
    expect(shouldAnimateNarrativeAct(false, false)).toBe(true);
  });
});
