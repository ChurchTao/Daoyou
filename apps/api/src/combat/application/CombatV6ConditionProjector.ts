import { runJournalSettlement, describeJournal } from '@server/player/application/JournalSettlement.js';
import { db } from '@server/lib/drizzle/db.js';
import { cultivators, messageConsumptions } from '@server/lib/drizzle/schema.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  settleBeastDeaths,
  settleBeastProgress,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import {
  claimMessageForConsumer,
  COMBAT_V6_CONDITION_CONSUMER,
} from '@server/lib/repositories/messageConsumptionRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { beastTradePreview } from '@daoyou/shared/contracts/beastTrade';
import { settleWildResources } from '@daoyou/shared/engine/combat-v6/wild/rules';
import { storyMarkForSignal } from '@daoyou/shared/story/signals';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import { and, eq } from 'drizzle-orm';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { grantInventory } from '@server/inventory/operations.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { StoryService } from '@server/story/application/StoryService.js';
import { readCultivatorPublicIdentity } from '@server/cultivator/facts.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { CombatV6RuntimeStore } from '@server/combat/application/CombatV6RuntimeStore.js';
import { CombatV6WildStore } from '@server/combat/application/CombatV6WildStore.js';

const store = new CombatV6WildStore();
const common = new CombatV6RuntimeStore();
export async function projectCombatV6Condition(
  battleId: string,
): Promise<void> {
  const receipt = await db
    .select({ messageId: messageConsumptions.messageId })
    .from(messageConsumptions)
    .where(
      and(
        eq(messageConsumptions.messageId, battleId),
        eq(messageConsumptions.consumerName, COMBAT_V6_CONDITION_CONSUMER),
      ),
    )
    .limit(1);
  if (receipt.length) {
    const s = await store.summary(battleId);
    if (s) await store.complete(s);
    return;
  }
  const record = await common.terminalRecord(battleId);
  if (!record) throw new Error('COMBAT_V6_TERMINAL_NOT_AVAILABLE');
  if (record.metadata.sourceType !== 'wild-encounter') return;
  const s = await store.summary(battleId);
  if (!s) throw new Error('COMBAT_V6_SETTLEMENT_MISSING');
  if (
    s.battleId !== record.battleId ||
    s.cultivatorId !== record.cultivatorId ||
    JSON.stringify(s.metadata) !== JSON.stringify(record.metadata)
  )
    throw new Error('COMBAT_V6_SETTLEMENT_IDENTITY_MISMATCH');
  await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(s.cultivatorId),
      context: 'wild-settlement',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const now = new Date();
      const committed = await db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, s.cultivatorId);
        // Transport receipt still resolves redelivery after Redis terminal data expires.
        const claimed = await claimMessageForConsumer(
          {
            consumerName: COMBAT_V6_CONDITION_CONSUMER,
            messageId: battleId,
            messageKey: 'combat.v6.battle.finished',
          },
          tx,
        );
        if (!claimed) return;
        return runJournalSettlement(tx, s.cultivatorId, 'wild_settlement', battleId, async () => {
        describeJournal(tx, s.cultivatorId, record.reason === 'fled' ? '逃离' : record.reason === 'technical-abort' ? '中止' : '结算');
        const met =
          (record.reason === 'battle-ended' || record.reason === 'fled') &&
          s.metadata.payload.nodeId
            ? storyMarkForSignal({
                type: 'wild.met',
                nodeId: s.metadata.payload.nodeId,
              })
            : null;
        const story = met
          ? await StoryService.noteFact(s.cultivatorId, met, tx)
          : null;
        if (record.reason === 'battle-ended' || record.reason === 'fled') {
          await settleBeastDeaths(
            s.cultivatorId,
            record.deadBeastIds ?? [],
            tx,
          );
          await settleBeastProgress(s, tx);
          const mutants = (s.capturedBeasts ?? []).filter(
            (beast) => beast.isMutant,
          );
          if (mutants.length) {
            const identity = await readCultivatorPublicIdentity(
              s.cultivatorId,
              tx,
            );
            for (const beast of mutants)
              await createDomainEvent(
                {
                  type: 'beast.exceptional.acquired',
                  aggregate: { type: 'beast', id: beast.id },
                  deduplicationKey: `beast-capture-rumor:${s.battleId}:${beast.id}`,
                  data: {
                    userId: s.userId,
                    cultivatorId: s.cultivatorId,
                    cultivatorName: identity.name,
                    source: 'capture',
                    beast: beastTradePreview(beast),
                  },
                },
                tx,
              );
          }
          if (record.reason === 'battle-ended')
            await grantInventory(s.cultivatorId, s.itemRewards ?? [], tx);
        }
        const [row] = await tx
          .select({ condition: cultivators.condition })
          .from(cultivators)
          .where(eq(cultivators.id, s.cultivatorId));
        if (!row?.condition) throw new Error('COMBAT_V6_CONDITION_MISSING');
        const resources = settleWildResources(
          s.final,
          s.entry,
          record.reason === 'technical-abort',
        );
        const condition = ConditionService.applyCombatV6Resources(
          row.condition as CultivatorCondition,
          resources,
          now,
        );
        await tx
          .update(cultivators)
          .set({ condition })
          .where(eq(cultivators.id, s.cultivatorId));
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: s.userId, cultivatorId: s.cultivatorId },
          source: 'combat-v6-condition',
          scopeDefaults: { cultivatorId: s.cultivatorId },
          changes: [
            ...(record.reason === 'battle-ended' && s.itemRewards?.length
              ? [
                  {
                    resourceTopic: 'inventory.bag' as const,
                    operation: 'invalidate' as const,
                    eventType: 'inventory.wild.rewarded',
                  },
                ]
              : []),
            {
              resourceTopic: 'player.condition',
              operation: 'invalidate',
              eventType: 'combat_v6.condition.settled',
            },
            ...(story?.changes ?? []),
          ],
        });
        lease.assertHeld();
        return state;
        });
      });
      if (committed) publishResourceEvents(committed.changes);
      await store.complete(s, now.getTime());
    },
  );
}

export async function retryCombatV6Settlements() {
  for (const id of await store.pending()) {
    const s = await store.summary(id);
    if (s && Date.now() - Date.parse(s.createdAt) > 86400000)
      console.error('[combat-v6] settlement overdue', { battleId: id });
    try {
      await projectCombatV6Condition(id);
    } catch (error) {
      console.warn('[combat-v6] settlement retry pending', {
        battleId: id,
        error,
      });
    }
  }
}
