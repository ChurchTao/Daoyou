import type { DbTransaction } from '@server/lib/drizzle/db';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { playerCommandExecutor } from './CommandExecutors';
import {
  FateReshapeService,
  prepareFateReshapeConfirmation,
  prepareFateReshapeStart,
} from './FateReshapeService';

export function startFateReshapeCommand(args: {
  userId: string;
  cultivatorId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'fate-reshape-start',
      timeoutMs: 60_000,
      retries: 0,
    },
    async (lease) => {
      const prepared = await prepareFateReshapeStart(
        args.userId,
        args.cultivatorId,
      );
      lease.assertHeld();
      let afterCommit: (() => Promise<void>) | undefined;
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source: 'fate_reshape_start',
        allowEmpty: true,
        command: async (tx) => {
          const command = await executeFateReshapeStartCommand(prepared, tx);
          afterCommit = command.afterCommit;
          return command;
        },
      });
      await afterCommit?.();
      const talismanCount = await FateReshapeService.getAvailableTalismanCount(
        args.cultivatorId,
      );
      return {
        ...committed,
        result: { ...committed.result, talismanCount },
      };
    },
  );
}

export function confirmFateReshapeCommand(args: {
  userId: string;
  cultivatorId: string;
  selectedIndices: number[];
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'fate-reshape-confirm',
      timeoutMs: 10_000,
      retries: 0,
    },
    async (lease) => {
      const prepared = await prepareFateReshapeConfirmation(
        args.userId,
        args.cultivatorId,
        args.selectedIndices,
      );
      lease.assertHeld();
      let afterCommit: (() => Promise<void>) | undefined;
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source: 'fate_reshape_confirm',
        command: async (tx) => {
          const command = await executeFateReshapeConfirmationCommand(
            prepared,
            tx,
          );
          afterCommit = command.afterCommit;
          return command;
        },
      });
      await afterCommit?.();
      return committed;
    },
  );
}

type PreparedFateReshapeStart = Awaited<
  ReturnType<typeof prepareFateReshapeStart>
>;

type PreparedFateReshapeConfirmation = Awaited<
  ReturnType<typeof prepareFateReshapeConfirmation>
>;

export async function executeFateReshapeStartCommand(
  prepared: PreparedFateReshapeStart,
  tx: DbTransaction,
): Promise<{
  result: {
    session: Awaited<ReturnType<typeof prepared.commit>>['session'];
  };
  resourceChanges: ResourceChangeDescriptor[];
  afterCommit?: () => Promise<void>;
}> {
  const committed = await prepared.commit(tx);
  return {
    result: { session: committed.session },
    resourceChanges: committed.consumption
      ? [
          {
            resourceTopic: 'inventory.consumables',
            eventType: 'inventory.fate_reshape.consumed',
            operation: 'invalidate',
          },
        ]
      : [],
    afterCommit: committed.afterCommit,
  };
}

export async function executeFateReshapeConfirmationCommand(
  prepared: PreparedFateReshapeConfirmation,
  tx: DbTransaction,
): Promise<{
  result: {
    selectedFates: Awaited<ReturnType<typeof prepared.commit>>['selectedFates'];
  };
  resourceChanges: ResourceChangeDescriptor[];
  afterCommit?: () => Promise<void>;
}> {
  const committed = await prepared.commit(tx);
  return {
    result: { selectedFates: committed.selectedFates },
    resourceChanges: [
      {
        resourceTopic: 'player.profile',
        eventType: 'profile.fates.changed',
        operation: 'merge',
        payload: {
          cultivator: { pre_heaven_fates: committed.selectedFates },
        },
      },
    ],
    afterCommit: committed.afterCommit,
  };
}
