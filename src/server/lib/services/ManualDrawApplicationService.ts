import type { DbTransaction } from '@server/lib/drizzle/db';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { ManualDrawService } from './ManualDrawService';
import {
  redisLockKeys,
  withRedisLock,
} from '@server/lib/redis/lock';
import { playerCommandExecutor } from './CommandExecutors';
import type { ManualDrawKind } from '@shared/types/manualDraw';

export function performManualDrawCommand(args: {
  userId: string;
  cultivatorId: string;
  kind: ManualDrawKind;
  count: 1 | 5;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'manual-draw',
      timeoutMs: 60_000,
      retries: 0,
    },
    async (lease) => {
      const prepared = await ManualDrawService.prepareDraw(
        args.cultivatorId,
        args.kind,
        args.count,
      );
      lease.assertHeld();
      return playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source: 'manual_draw',
        command: (tx) =>
          executeManualDrawCommand({
            userId: args.userId,
            cultivatorId: args.cultivatorId,
            prepared,
            tx,
          }),
      });
    },
  );
}

type PreparedManualDraw = Awaited<
  ReturnType<typeof ManualDrawService.prepareDraw>
>;

export async function executeManualDrawCommand(args: {
  userId: string;
  cultivatorId: string;
  prepared: PreparedManualDraw;
  tx: DbTransaction;
}): Promise<{
  result: Awaited<ReturnType<typeof ManualDrawService.commitPreparedDraw>>;
  resourceChanges: ResourceChangeDescriptor[];
}> {
  const result = await ManualDrawService.commitPreparedDraw(
    args.userId,
    args.cultivatorId,
    args.prepared,
    args.tx,
  );
  return {
    result,
    resourceChanges: [],
  };
}
