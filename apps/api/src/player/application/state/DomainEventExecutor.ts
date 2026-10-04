import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository.js';
import {
  systemCommandExecutor,
  type FeatureCommandResult,
} from '@server/player/application/state/CommandExecutors.js';
import type { DomainEventType } from '@daoyou/game-domain/events';
import type { DomainEventEnvelope } from '@daoyou/contracts/events';

type DomainEventSkipResult = { status: 'already_processed' };

export function executeDomainEvent<
  TType extends DomainEventType,
  TResult,
>(input: {
  consumerName: string;
  source: string;
  event: DomainEventEnvelope<TType>;
  handle(
    event: DomainEventEnvelope<TType>,
    tx: DbTransaction,
  ): Promise<FeatureCommandResult<TResult>>;
}) {
  return systemCommandExecutor.execute<TResult | DomainEventSkipResult>({
    source: input.source,
    requestId: input.event.id,
    allowEmpty: true,
    command: async (tx) => {
      const claimed = await claimMessageForConsumer(
        {
          consumerName: input.consumerName,
          messageId: input.event.id,
          messageKey: input.event.type,
        },
        tx,
      );
      if (!claimed) {
        return {
          result: { status: 'already_processed' },
          resourceChanges: [],
        };
      }
      return input.handle(input.event, tx);
    },
  });
}
