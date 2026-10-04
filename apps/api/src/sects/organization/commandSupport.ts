import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { SectRuntime } from '@daoyou/game-rules/sect-organization';

export type SectCommandArgs = {
  userId: string;
  cultivatorId: string;
  source: string;
  idempotency: { key: string; fingerprint: string };
  runtime: SectRuntime;
};

export function executeSectPlayerCommand<TResult>(
  args: SectCommandArgs,
  command: (tx: DbTransaction) => Promise<{
    result: TResult;
    resourceChanges: ResourceChangeDescriptor[];
  }>,
) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: args.source,
    idempotency: args.idempotency,
    command,
  });
}
