import type { DbTransaction } from '@server/lib/drizzle/db';
import { systemCommandExecutor } from '@server/lib/services/CommandExecutors';
import { StoryService } from '@server/lib/services/StoryService';
import { CombatV6RuntimeStore } from '@server/lib/services/combat-v6/CombatV6RuntimeStore';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { storyMarkForSignal } from '@shared/story/signals';

export async function projectStoryDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<{ resourceChanges: ResourceChangeDescriptor[] }> {
  const signal = isDomainEventType(event, 'alchemy.craft.completed')
    ? {
        cultivatorId: event.data.cultivatorId,
        fact: storyMarkForSignal({ type: 'alchemy.craft.completed' }),
      }
    : isDomainEventType(event, 'dungeon.run.settled')
      ? {
          cultivatorId: event.data.cultivatorId,
          fact: storyMarkForSignal({
            type: 'dungeon.run.settled',
            outcome: event.data.outcome,
          }),
        }
      : null;
  if (!signal?.fact) return { resourceChanges: [] };
  const noted = await StoryService.noteFact(
    signal.cultivatorId,
    signal.fact,
    tx,
  );
  return { resourceChanges: noted?.changes ?? [] };
}

export async function observeCombatStory(battleId: string): Promise<void> {
  const record = await new CombatV6RuntimeStore().terminalRecord(battleId);
  if (!record) throw new Error('COMBAT_V6_TERMINAL_NOT_AVAILABLE');
  const fact = storyMarkForSignal({
    type: 'combat.v6.battle.finished',
    sourceType: record.metadata.sourceType,
    outcome: record.outcome,
  });
  if (!fact) return;
  await systemCommandExecutor.execute({
    source: 'story_combat_fact',
    requestId: battleId,
    allowEmpty: true,
    actor: { cultivatorId: record.cultivatorId },
    command: async (tx) => {
      const noted = await StoryService.noteFact(record.cultivatorId, fact, tx);
      return {
        result: { status: noted ? 'applied' : 'ignored' },
        resourceChanges: noted?.changes ?? [],
      };
    },
  });
}
