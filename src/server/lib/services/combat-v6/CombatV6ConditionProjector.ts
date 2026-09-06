import { db } from '@server/lib/drizzle/db';
import {
  messageConsumptions,
  cultivators,
} from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  claimMessageForConsumer,
  COMBAT_V6_CONDITION_CONSUMER,
} from '@server/lib/repositories/messageConsumptionRepository';
import { settleWildResources } from '@shared/engine/combat-v6/wild/rules';
import type { CultivatorCondition } from '@shared/types/condition';
import { and, eq } from 'drizzle-orm';
import { ConditionService } from '../ConditionService';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { CombatV6WildStore } from './CombatV6WildStore';

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
      await db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, s.cultivatorId);
        // A battle has one settlement. Use its UUID as the logical message key
        // for both MQ delivery and coordinator retries (which have no envelope).
        const claimed = await claimMessageForConsumer(
          {
            consumerName: COMBAT_V6_CONDITION_CONSUMER,
            messageId: battleId,
            messageKey: 'combat.v6.battle.finished',
          },
          tx,
        );
        if (!claimed) return;
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
        await new ResourceEventCommitter().commit(tx, {
          actor: { userId: s.userId, cultivatorId: s.cultivatorId },
          source: 'combat-v6-condition',
          scopeDefaults: { cultivatorId: s.cultivatorId },
          changes: [
            {
              resourceTopic: 'player.condition',
              operation: 'invalidate',
              eventType: 'combat_v6.condition.settled',
            },
          ],
        });
        lease.assertHeld();
      });
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
