import { describe, expect, it, vi } from 'vitest';
import {
  beginSectJoinAttempt,
  createSectJoinAttemptState,
  finishSectJoinAttempt,
} from './sectJoinAttempt';

describe('sect onboarding join attempt', () => {
  it('blocks repeated submission while a join is in flight', () => {
    const createKey = vi.fn(() => 'join-key');
    const first = beginSectJoinAttempt(
      createSectJoinAttemptState(),
      createKey,
    );
    const repeated = beginSectJoinAttempt(first.state, createKey);

    expect(first.key).toBe('join-key');
    expect(repeated.key).toBeUndefined();
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('reuses the same idempotency key for a retry and resets with the sect', () => {
    const first = beginSectJoinAttempt(
      createSectJoinAttemptState(),
      () => 'first-key',
    );
    const retry = beginSectJoinAttempt(
      finishSectJoinAttempt(first.state),
      () => 'second-key',
    );
    const switched = beginSectJoinAttempt(
      createSectJoinAttemptState(),
      () => 'second-key',
    );

    expect(retry.key).toBe('first-key');
    expect(switched.key).toBe('second-key');
  });
});
