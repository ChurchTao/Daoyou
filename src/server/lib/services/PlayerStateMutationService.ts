import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  bumpStateVersions,
  findPlayerMutationRequest,
  getOrCreateStateVersion,
  insertPlayerMutationRequest,
  insertStateEvents,
  lockCultivatorForStateMutation,
} from '@server/lib/repositories/playerStateRepository';
import { publishPlayerStateEvents } from '@server/lib/services/playerStateBroadcaster';
import type {
  PlayerStateDomain,
  PlayerStateDomainVersions,
  PlayerStateMutationMeta,
  PlayerStateMutationResponse,
} from '@shared/contracts/player';

const RETRYABLE_TRANSACTION_CODES = new Set(['40P01', '40001']);
const MAX_TRANSACTION_ATTEMPTS = 3;

export type StateChangeDescriptor = {
  domain: PlayerStateDomain;
  eventType: string;
  patch?: unknown;
  invalidates?: PlayerStateDomain[];
};

export class PlayerStateIdempotencyError extends Error {
  readonly code = 'IDEMPOTENCY_KEY_REUSED';
  readonly status = 409;
}

export async function commitPlayerStateMutation<T>(args: {
  userId: string;
  cultivatorId: string;
  source: string;
  requestId?: string | null;
  idempotency?: {
    key: string;
    fingerprint: string;
  };
  allowEmpty?: boolean;
  run: (tx: DbTransaction) => Promise<{
    result: T;
    changes: StateChangeDescriptor[];
  }>;
}): Promise<{
  result: T;
  state: PlayerStateMutationMeta;
}> {
  const committed = await runRetryableStateTransaction(async () =>
    db().transaction(async (tx) => {
      await lockCultivatorForStateMutation(tx, args.cultivatorId);

      if (args.idempotency) {
        const existing = await findPlayerMutationRequest(
          args.cultivatorId,
          args.source,
          args.idempotency.key,
          tx,
        );
        if (existing) {
          if (existing.requestFingerprint !== args.idempotency.fingerprint) {
            throw new PlayerStateIdempotencyError(
              '同一幂等键不能用于不同的宗门事务',
            );
          }
          const version = await getOrCreateStateVersion(args.cultivatorId, tx);
          return {
            result: existing.result as T,
            state: {
              cultivatorId: args.cultivatorId,
              globalVersion: version.globalVersion,
              domainVersions: {},
              events: [],
              replayed: true,
            },
          };
        }
      }

      const { result, changes } = await args.run(tx);

      if (changes.length === 0) {
        if (args.allowEmpty) {
          const version = await getOrCreateStateVersion(args.cultivatorId, tx);
          const committed = {
            result,
            state: {
              cultivatorId: args.cultivatorId,
              globalVersion: version.globalVersion,
              domainVersions: {},
              events: [],
            },
          };
          if (args.idempotency)
            await insertPlayerMutationRequest(
              {
                cultivatorId: args.cultivatorId,
                source: args.source,
                requestId: args.idempotency.key,
                requestFingerprint: args.idempotency.fingerprint,
                result,
              },
              tx,
            );
          return committed;
        }
        throw new Error('玩家状态写操作缺少状态变更描述');
      }

      const versions = await bumpStateVersions(
        tx,
        args.cultivatorId,
        changes.map((change) => change.domain),
      );
      const events = await insertStateEvents(tx, {
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        globalVersion: versions.globalVersion,
        domainVersions: versions.domainVersions,
        events: changes.map((change) => ({
          ...change,
          source: args.source,
          requestId: args.requestId ?? args.idempotency?.key ?? null,
        })),
      });

      const committed = {
        result,
        state: {
          cultivatorId: args.cultivatorId,
          globalVersion: versions.globalVersion,
          domainVersions: pickChangedDomainVersions(
            versions.domainVersions,
            changes.map((change) => change.domain),
          ),
          events,
        },
      };
      if (args.idempotency)
        await insertPlayerMutationRequest(
          {
            cultivatorId: args.cultivatorId,
            source: args.source,
            requestId: args.idempotency.key,
            requestFingerprint: args.idempotency.fingerprint,
            result,
          },
          tx,
        );
      return committed;
    }),
  );

  if (committed.state.events.length > 0) {
    publishPlayerStateEvents(args.cultivatorId, committed.state.events);
  }

  return committed;
}

export function toPlayerStateMutationResponse<T>(
  committed: {
    result: T;
    state: PlayerStateMutationMeta;
  },
): PlayerStateMutationResponse<T> {
  return {
    success: true,
    data: committed.result,
    state: committed.state,
  };
}

function pickChangedDomainVersions(
  domainVersions: PlayerStateDomainVersions,
  domains: PlayerStateDomain[],
): Partial<PlayerStateDomainVersions> {
  const uniqueDomains = Array.from(new Set(domains));
  return uniqueDomains.reduce<Partial<PlayerStateDomainVersions>>(
    (acc, domain) => {
      acc[domain] = domainVersions[domain];
      return acc;
    },
    {},
  );
}

async function runRetryableStateTransaction<T>(
  run: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (
        attempt >= MAX_TRANSACTION_ATTEMPTS ||
        !isRetryableTransactionError(error)
      ) {
        throw error;
      }

      await sleep(getRetryDelayMs(attempt));
    }
  }

  throw lastError;
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    RETRYABLE_TRANSACTION_CODES.has(
      String((error as { code?: unknown }).code ?? ''),
    )
  );
}

function getRetryDelayMs(attempt: number): number {
  const baseDelayMs = 25 * 2 ** (attempt - 1);
  return baseDelayMs + Math.floor(Math.random() * 15);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
