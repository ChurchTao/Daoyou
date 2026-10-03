import { resourceStore } from '@app/lib/resources/store';
import type { ApiFailure } from '@daoyou/shared/contracts/http';
import type {
  PlayerResourceMutationMeta,
  PlayerStateMutationResponse,
} from '@daoyou/shared/contracts/player';
import type { ResourceChange } from '@daoyou/shared/contracts/resources';
import { useMemo } from 'react';

export async function consumeResourceMutation<T>(
  input: Response | PlayerStateMutationResponse<T> | ApiFailure,
): Promise<T> {
  return resourceStore.consumeMutation(input);
}

export function consumeResourceChanges(
  state: PlayerResourceMutationMeta | readonly ResourceChange[],
): void {
  resourceStore.consumeChanges(
    'changes' in state ? state.changes : [...state],
  );
}

export function useResourceMutation() {
  return useMemo(
    () => ({
      mutate<T>(
        input: Promise<Response | PlayerStateMutationResponse<T> | ApiFailure>,
      ) {
        return input.then((value) => resourceStore.consumeMutation(value));
      },
      consumeChanges: consumeResourceChanges,
    }),
    [],
  );
}
