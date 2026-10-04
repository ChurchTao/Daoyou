import type {
  PlayerResourceMutationMeta,
  PlayerStateMutationResponse,
} from '@daoyou/contracts/player';

export function toPlayerStateMutationResponse<T>(committed: {
  result: T;
  state: PlayerResourceMutationMeta;
}): PlayerStateMutationResponse<T> {
  return {
    success: true,
    data: committed.result,
    state: committed.state,
  };
}
