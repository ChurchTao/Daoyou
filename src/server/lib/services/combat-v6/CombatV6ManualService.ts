import { db, type DbExecutor } from '@server/lib/drizzle/db';
import {
  combatV6BuildProfiles,
  combatV6ManualSlots,
  combatV6ManualStates,
  inventoryItems,
} from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  characterIdentityRow,
  loadActiveCombatV6Build,
} from '@server/lib/repositories/combatV6BuildRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import type {
  ManualAction,
  ManualView,
} from '@shared/contracts/combatV6Manuals';
import { findItemDefinition } from '@shared/items/registry';
import { previewManualAction } from '@shared/manuals/action';
import type { RealmType } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';
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
  const build = await loadActiveCombatV6Build(owner, q);
  return { character, build };
}

export async function readManuals(owner: string): Promise<ManualView> {
  return db.transaction(
    async (tx) => {
      const { character, build } = await readManualFacts(owner, tx);
      const rows = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.cultivatorId, owner),
            eq(inventoryItems.location, 'bag'),
          ),
        );
      let blockedReason: string | null = build
        ? null
        : '请先在宗门完成战斗构筑';
      if (build) {
        try {
          await assertInventoryIdle(owner);
        } catch (error) {
          if (!(error instanceof InventoryError)) throw error;
          blockedReason = '请先结束战斗与结算，再调整道印';
        }
      }
      return {
        realm: character.realm as RealmType,
        state: build?.manuals ?? null,
        items: rows
          .filter(
            (row) =>
              findItemDefinition(row.definitionId)?.kind === 'manual_jade',
          )
          .map(inventoryItemOf),
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
        const { character, build } = await readManualFacts(owner, tx);
        if (!build) throw new InventoryError('请先在宗门完成战斗构筑');
        const [manualState] = await tx
          .select()
          .from(combatV6ManualStates)
          .where(eq(combatV6ManualStates.profileId, build.profileId));
        if (!manualState || manualState.revision !== action.expectedRevision)
          throw new InventoryError('道印已变化，请刷新后重试');
        const rows =
          action.action === 'learn'
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
          build.manuals,
          character.realm as RealmType,
          action,
          item,
        );
        if (!result.ok)
          throw new InventoryError(
            result.diagnostics.map((d) => d.message).join('；'),
          );

        const updated = await tx
          .update(combatV6ManualStates)
          .set({ revision: result.state.revision })
          .where(
            and(
              eq(combatV6ManualStates.id, manualState.id),
              eq(combatV6ManualStates.revision, action.expectedRevision),
            ),
          )
          .returning({ id: combatV6ManualStates.id });
        if (!updated.length)
          throw new InventoryError('道印已变化，请刷新后重试');
        await tx
          .delete(combatV6ManualSlots)
          .where(
            and(
              eq(combatV6ManualSlots.stateId, manualState.id),
              eq(combatV6ManualSlots.slot, action.slot),
            ),
          );
        const nextSlot = result.state.build.slots.find(
          (entry) => entry.slot === action.slot,
        );
        if (nextSlot)
          await tx
            .insert(combatV6ManualSlots)
            .values({ stateId: manualState.id, ...nextSlot });
        if (action.action === 'learn') {
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
        await tx
          .update(combatV6BuildProfiles)
          .set({ revision: sql`${combatV6BuildProfiles.revision} + 1` })
          .where(eq(combatV6BuildProfiles.id, build.profileId));
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: character.userId, cultivatorId: owner },
          source: 'combat-v6-manuals',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            {
              resourceTopic: 'player.combat-v6-build',
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
