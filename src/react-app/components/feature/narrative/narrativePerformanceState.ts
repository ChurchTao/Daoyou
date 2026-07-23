export interface NarrativePerformanceState {
  actIndex: number;
  revealed: boolean;
}

export const createNarrativePerformanceState = (): NarrativePerformanceState => ({
  actIndex: 0,
  revealed: false,
});

export function shouldAnimateNarrativeAct(
  reducedMotion: boolean,
  revealed: boolean,
): boolean {
  return !reducedMotion && !revealed;
}

export function advanceNarrativePerformance(
  state: NarrativePerformanceState,
  actCount: number,
): NarrativePerformanceState {
  if (!state.revealed) return { ...state, revealed: true };
  if (state.actIndex >= actCount - 1) return state;
  return { actIndex: state.actIndex + 1, revealed: false };
}

export function rewindNarrativePerformance(
  state: NarrativePerformanceState,
): NarrativePerformanceState {
  if (state.actIndex === 0) return state;
  return { actIndex: state.actIndex - 1, revealed: true };
}
