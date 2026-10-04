export interface SectJoinAttemptState {
  key?: string;
  inFlight: boolean;
}

export const createSectJoinAttemptState = (): SectJoinAttemptState => ({
  inFlight: false,
});

export function beginSectJoinAttempt(
  state: SectJoinAttemptState,
  createKey: () => string,
): { state: SectJoinAttemptState; key?: string } {
  if (state.inFlight) return { state };
  const key = state.key ?? createKey();
  return { state: { key, inFlight: true }, key };
}

export function finishSectJoinAttempt(
  state: SectJoinAttemptState,
): SectJoinAttemptState {
  return { ...state, inFlight: false };
}
