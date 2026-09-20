import { infiniteTowerService } from '@server/lib/infiniteTower/service';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { playerCommandExecutor } from './CommandExecutors';
import { toPlayerStateMutationResponse } from './ResourceMutationResponse';

const COMMAND_TIMEOUT_MS = 240_000;

export function executeInfiniteTowerProbeCommand(cultivatorId: string) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(cultivatorId),
      context: 'infinite-tower-probe',
      timeoutMs: COMMAND_TIMEOUT_MS,
      retries: 0,
    },
    () => infiniteTowerService.probeBattle(cultivatorId),
  );
}

export function executeInfiniteTowerBattleCommand(args: {
  userId: string;
  cultivatorId: string;
  battleId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'infinite-tower-battle',
      timeoutMs: COMMAND_TIMEOUT_MS,
      retries: 0,
    },
    async (lease) => {
      const committed = await playerCommandExecutor.execute<{
        response: Awaited<
          ReturnType<typeof infiniteTowerService.executeBattle>
        >['response'];
        runtimeCommit: Awaited<
          ReturnType<typeof infiniteTowerService.executeBattle>
        >['runtimeCommit'];
      }>({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source: 'infinite_tower_battle_execute',
        requestId: args.battleId,
        idempotency: {
          key: `infinite-tower-battle:${args.battleId}`,
          fingerprint: `${args.cultivatorId}:${args.battleId}`,
        },
        allowEmpty: true,
        command: async (tx) => {
          const result = await infiniteTowerService.executeBattle({
            ...args,
            tx,
          });
          return { result, resourceChanges: result.resourceChanges };
        },
      });

      lease.assertHeld();
      await infiniteTowerService.commitBattleRuntime(
        committed.result.runtimeCommit,
      );
      return toPlayerStateMutationResponse({
        result: committed.result.response,
        state: committed.state,
      });
    },
  );
}
