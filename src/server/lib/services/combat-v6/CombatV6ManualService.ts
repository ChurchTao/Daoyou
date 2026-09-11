import { readCharacterManuals } from '@server/lib/repositories/characterLoadoutRepository';
import { db, type DbExecutor } from '@server/lib/drizzle/db';
import {
  cultivatorManualSlots,
  cultivatorManualStates,
  cultivators,
  inventoryItems,
} from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  characterIdentityRow,
} from '@server/lib/repositories/sectCombatRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  getOrInitCultivationProgress,
  stripExpCapForStorage,
  syncBottleneckState,
} from '@server/utils/cultivationUtils';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import { previewManualAction } from '@shared/manuals/action';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { CultivationProgress } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import {
  assertInventoryIdle,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from '../InventoryService';
import { ResourceEventCommitter } from '../ResourceEventCommitter';

async function readManualFacts(owner: string, q: DbExecutor) {
  const character = await characterIdentityRow(owner, q);
  if (!character) throw new InventoryError('角色不可用');
  const manuals = await readCharacterManuals(owner, q);
  const [row] = await q
    .select({
      progress: cultivators.cultivation_progress,
      stage: cultivators.realm_stage,
    })
    .from(cultivators)
    .where(eq(cultivators.id, owner));
  const progress = getOrInitCultivationProgress(
    row.progress as CultivationProgress,
    character.realm as RealmType,
    row.stage as RealmStage,
  );
  return { character, manuals, progress };
}

export async function readManuals(owner: string): Promise<ManualView> {
  return db.transaction(
    async (tx) => {
      const { character, manuals, progress } = await readManualFacts(owner, tx);
      let blockedReason: string | null = null;
      {
        try {
          await assertInventoryIdle(owner);
        } catch (error) {
          if (!(error instanceof InventoryError)) throw error;
          blockedReason = '请先结束战斗与结算，再调整功法';
        }
      }
      return {
        realm: character.realm as RealmType,
        resources: {
          experience: progress.cultivation_exp,
          insight: progress.comprehension_insight,
          experienceCap: progress.exp_cap,
        },
        state: manuals,
        blockedReason,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

export async function mutateManuals(owner: string, action: ManualAction) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'manuals',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        await assertInventoryIdle(owner);
        const { character, manuals, progress } = await readManualFacts(owner, tx);
        await tx.insert(cultivatorManualStates).values({cultivatorId: owner}).onConflictDoNothing();
        if (manuals.revision !== action.expectedRevision)
          throw new InventoryError('功法已变化，请刷新后重试');
        const rows =
          'item' in action
            ? await tx
                .select()
                .from(inventoryItems)
                .where(
                  and(
                    eq(inventoryItems.cultivatorId, owner),
                    eq(inventoryItems.id, action.item.id),
                  ),
                )
            : [];
        const before = rows.map(inventoryItemOf);
        const item = before[0];
        const result = previewManualAction(
          manuals,
          character.realm as RealmType,
          action,
          {
            experience: progress.cultivation_exp,
            insight: progress.comprehension_insight,
          },
          item,
        );
        if (!result.ok)
          throw new InventoryError(
            result.diagnostics.map((d) => d.message).join('；'),
          );

        const updated = await tx
          .update(cultivatorManualStates)
          .set({
            revision: result.state.revision,
            learned: result.state.learned,
          })
          .where(
            and(
              eq(cultivatorManualStates.cultivatorId, owner),
              eq(cultivatorManualStates.revision, action.expectedRevision),
            ),
          )
          .returning({ id: cultivatorManualStates.cultivatorId });
        if (!updated.length)
          throw new InventoryError('功法已变化，请刷新后重试');
        await tx
          .delete(cultivatorManualSlots)
          .where(
            and(
              eq(cultivatorManualSlots.cultivatorId, owner),
              eq(cultivatorManualSlots.slot, action.slot),
            ),
          );
        const nextSlot = result.state.build.slots.find(
          (entry) => entry.slot === action.slot,
        );
        if (nextSlot)
          await tx
            .insert(cultivatorManualSlots)
            .values({ cultivatorId: owner, ...nextSlot });
        if ('item' in action) {
          await saveInventoryPlan(
            owner,
            before,
            item.quantity === 1
              ? []
              : [
                  {
                    ...item,
                    quantity: item.quantity - 1,
                    revision: item.revision + 1,
                  },
                ],
            tx,
          );
        }
        if (action.action === 'train') {
          progress.cultivation_exp -= result.cost.experience;
          progress.comprehension_insight -= result.cost.insight;
          syncBottleneckState(progress);
          await tx
            .update(cultivators)
            .set({
              cultivation_progress: stripExpCapForStorage(progress),
              updatedAt: new Date(),
            })
            .where(eq(cultivators.id, owner));
        }
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: character.userId, cultivatorId: owner },
          source: 'combat-v6-manuals',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            {
              resourceTopic: 'player.progress',
              operation: 'invalidate',
              eventType: 'combat_v6.manuals.changed',
            },
            {
              resourceTopic: 'player.profile',
              operation: 'invalidate',
              eventType: 'combat_v6.manuals.changed',
            },
          ],
        });
        lease.assertHeld();
        return { data: result.state, state };
      }),
  );
}
