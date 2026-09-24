import { db, type DbTransaction } from '@server/lib/drizzle/db';
import { assertCombatV6MutationAllowed } from './combat-v6/CombatV6MutationGuard';
import {
  findPlayerMutationRequest,
  insertPlayerMutationRequest,
  listResourceChangesForRequest,
  lockCultivatorForStateMutation,
  readScopeVersion,
} from '@server/lib/repositories/playerStateRepository';
import {
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock';
import { publishResourceEvents } from '@server/lib/services/playerStateBroadcaster';
import type { PlayerResourceMutationMeta } from '@shared/contracts/player';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { createHash } from 'node:crypto';
import {
  baselinesFromResourceChanges,
  resourceEventCommitter,
} from './ResourceEventCommitter';

const RETRYABLE_TRANSACTION_CODES = new Set(['40P01', '40001', '55P03']);
const MAX_TRANSACTION_ATTEMPTS = 3;
const SLOW_TRANSACTION_THRESHOLD_MS = 500;

export type FeatureCommandResult<TResult> = {
  result: TResult;
  resourceChanges: ResourceChangeDescriptor[];
};

export type CommittedCommand<TResult> = {
  result: TResult;
  state: PlayerResourceMutationMeta;
};

export type PlayerCommandCoordination =
  | { mode: 'redis'; lease: RedisLeaseContext }
  | { mode: 'database-only' };

export class PlayerCommandExecutor {
  async executeInitial<TResult>(input: {
    userId: string;
    source: string;
    command(
      tx: DbTransaction,
    ): Promise<
      FeatureCommandResult<TResult> & {
        cultivatorId: string;
      }
    >;
  }): Promise<CommittedCommand<TResult>> {
    const committed = await runRetryableTransaction(() =>
      db.transaction(async (tx) => {
        const command = await input.command(tx);
        if (command.resourceChanges.length === 0) {
          throw new Error('初始玩家写操作缺少资源变更描述');
        }
        const state = await resourceEventCommitter.commit(tx, {
          actor: {
            userId: input.userId,
            cultivatorId: command.cultivatorId,
          },
          source: input.source,
          changes: command.resourceChanges,
          scopeDefaults: {
            accountId: input.userId,
            cultivatorId: command.cultivatorId,
          },
        });
        return { result: command.result, state };
      }),
    );
    publishResourceEvents(committed.state.changes);
    return committed;
  }

  executeWithLock<TResult>(input: {
    userId: string;
    cultivatorId: string;
    source: string;
    requestId?: string | null;
    idempotency?: { key: string; fingerprint: string };
    allowEmpty?: boolean;
    lock?: {
      context?: string;
      timeoutMs?: number;
    };
    command(tx: DbTransaction): Promise<FeatureCommandResult<TResult>>;
  }): Promise<CommittedCommand<TResult>> {
    return withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(input.cultivatorId),
        context: input.lock?.context ?? `player-command:${input.source}`,
        timeoutMs: input.lock?.timeoutMs ?? 30_000,
        retries: 0,
      },
      (lease) =>
        this.execute({
          ...input,
          coordination: { mode: 'redis', lease },
        }),
    );
  }

  async execute<TResult>(
    input: {
      userId: string;
      cultivatorId: string;
      source: string;
      requestId?: string | null;
      idempotency?: { key: string; fingerprint: string };
      allowEmpty?: boolean;
      command(tx: DbTransaction): Promise<FeatureCommandResult<TResult>>;
      coordination: PlayerCommandCoordination;
    },
  ): Promise<CommittedCommand<TResult>> {
    const lease =
      input.coordination.mode === 'redis'
        ? input.coordination.lease
        : undefined;
    lease?.assertHeld();
    const idempotency = input.idempotency
      ? normalizeIdempotency(input.idempotency)
      : undefined;
    const eventRequestId = normalizeNullableField(
      input.requestId ?? idempotency?.key ?? null,
    );
    const committed = await runRetryableTransaction(async (retryAttempt) => {
      const startedAt = Date.now();
      try {
        const result = await db.transaction(async (tx) => {
          await lockCultivatorForStateMutation(tx, input.cultivatorId);
          await assertCombatV6MutationAllowed(input.cultivatorId, input.source);
          if (idempotency) {
            const existing = await findPlayerMutationRequest(
              input.cultivatorId,
              input.source,
              idempotency.key,
              tx,
            );
            if (existing) {
              if (existing.requestFingerprint !== idempotency.fingerprint) {
                throw new PlayerCommandIdempotencyError(
                  '同一幂等键不能用于不同的玩家状态事务',
                );
              }
              const changes = await listResourceChangesForRequest(
                input.cultivatorId,
                input.source,
                idempotency.key,
                tx,
              );
              lease?.assertHeld();
              return {
                result: existing.result as TResult,
                state: {
                  changes,
                  baselines: baselinesFromResourceChanges(changes),
                  replayed: true,
                },
              };
            }
          }

          const command = await input.command(tx);
          if (command.resourceChanges.length === 0 && !input.allowEmpty) {
            throw new Error('玩家写操作缺少资源变更描述');
          }
          const state =
            command.resourceChanges.length === 0
              ? {
                  changes: [],
                  baselines: [
                    {
                      scope: {
                        kind: 'cultivator' as const,
                        id: input.cultivatorId,
                      },
                      scopeVersion: await readScopeVersion(
                        {
                          kind: 'cultivator',
                          id: input.cultivatorId,
                        },
                        tx,
                      ),
                    },
                  ],
                }
              : await resourceEventCommitter.commit(tx, {
                  actor: {
                    userId: input.userId,
                    cultivatorId: input.cultivatorId,
                  },
                  source: input.source,
                  requestId: eventRequestId,
                  changes: command.resourceChanges,
                  scopeDefaults: {
                    accountId: input.userId,
                    cultivatorId: input.cultivatorId,
                  },
                });
          if (idempotency) {
            await insertPlayerMutationRequest(
              {
                cultivatorId: input.cultivatorId,
                source: input.source,
                requestId: idempotency.key,
                requestFingerprint: idempotency.fingerprint,
                result: command.result,
              },
              tx,
            );
          }
          lease?.assertHeld();
          return { result: command.result, state };
        });
        logTransaction(
          'completed',
          input.source,
          input.cultivatorId,
          input.requestId,
          retryAttempt,
          startedAt,
        );
        return result;
      } catch (error) {
        logTransaction(
          'failed',
          input.source,
          input.cultivatorId,
          input.requestId,
          retryAttempt,
          startedAt,
          error,
        );
        throw error;
      }
    });
    if (committed.state.changes.length > 0) {
      publishResourceEvents(committed.state.changes);
    }
    return committed;
  }
}

export class SystemCommandExecutor {
  async execute<TResult>(input: {
    source: string;
    actor?: { userId?: string | null; cultivatorId?: string | null };
    requestId?: string | null;
    allowEmpty?: boolean;
    command(tx: DbTransaction): Promise<FeatureCommandResult<TResult>>;
  }): Promise<CommittedCommand<TResult>> {
    const committed = await runRetryableTransaction(() =>
      db.transaction(async (tx) => {
        const command = await input.command(tx);
        if (command.resourceChanges.length === 0 && !input.allowEmpty) {
          throw new Error('系统写操作缺少资源变更描述');
        }
        const state = await resourceEventCommitter.commit(tx, {
          actor: input.actor,
          source: input.source,
          requestId: input.requestId,
          changes: command.resourceChanges,
        });
        return { result: command.result, state };
      }),
    );
    if (committed.state.changes.length > 0) {
      publishResourceEvents(committed.state.changes);
    }
    return committed;
  }
}

export class PlayerCommandIdempotencyError extends Error {
  readonly code = 'IDEMPOTENCY_KEY_REUSED';
  readonly status = 409;
}

export const playerCommandExecutor = new PlayerCommandExecutor();
export const systemCommandExecutor = new SystemCommandExecutor();

function normalizeIdempotency(value: {
  key: string;
  fingerprint: string;
}): { key: string; fingerprint: string } {
  return {
    key: normalizeField(value.key),
    fingerprint: normalizeField(value.fingerprint),
  };
}

function normalizeNullableField(value: string | null): string | null {
  return value === null ? null : normalizeField(value);
}

function normalizeField(value: string): string {
  if (Buffer.byteLength(value, 'utf8') <= 128) return value;
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function runRetryableTransaction<TResult>(
  run: (attempt: number) => Promise<TResult>,
): Promise<TResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      lastError = error;
      if (
        attempt >= MAX_TRANSACTION_ATTEMPTS ||
        !(
          typeof error === 'object' &&
          error !== null &&
          RETRYABLE_TRANSACTION_CODES.has(
            String((error as { code?: unknown }).code ?? ''),
          )
        )
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          25 * 2 ** (attempt - 1) + Math.floor(Math.random() * 15),
        ),
      );
    }
  }
  throw lastError;
}

function logTransaction(
  outcome: 'completed' | 'failed',
  source: string,
  cultivatorId: string,
  requestId: string | null | undefined,
  retryAttempt: number,
  startedAt: number,
  error?: unknown,
): void {
  const durationMs = Date.now() - startedAt;
  const details = {
    outcome,
    source,
    cultivatorId,
    requestId: requestId ?? null,
    durationMs,
    retryAttempt,
    postgresCode:
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null,
  };
  if (outcome === 'failed') {
    console.error('[player-command-transaction]', details);
  } else if (durationMs >= SLOW_TRANSACTION_THRESHOLD_MS) {
    console.info('[player-command-transaction]', details);
  }
}
