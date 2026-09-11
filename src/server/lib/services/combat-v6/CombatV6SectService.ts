import { db } from '@server/lib/drizzle/db';
import {
  sectCombatStates,
  sectMeridianLoadouts,
  sectMeridianNodes,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  characterIdentityRow,
  readActiveSectCombatProgress,
} from '@server/lib/repositories/sectCombatRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import {
  loadSectCultivatorProgress,
  spendTrainingResources,
} from '@server/lib/repositories/sectRepository';
import type { SectV6Action, SectV6View } from '@shared/contracts/combatV6Sect';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '@shared/engine/combat-v6/content';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import { sectV6Change } from '@shared/engine/combat-v6/sect-progression';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { assertInventoryIdle, InventoryError } from '../InventoryService';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { getSectCombatView } from './CombatV6BuildService';

export async function readSectV6(owner: string): Promise<SectV6View> {
  return db.transaction(
    async (tx) => {
      const character = await loadSectCultivatorProgress(owner, tx);
      if (!character) throw new InventoryError('角色不存在');
      const build = await getSectCombatView(owner, tx);
      const active =
        build.status === 'active'
          ? await readActiveSectCombatProgress(owner, tx)
          : null;
      let blockedReason: string | null =
        build.status === 'active' ? null : '请先选择流派，启用宗门传承';
      try {
        await assertInventoryIdle(owner);
      } catch (error) {
        if (!(error instanceof InventoryError)) throw error;
        blockedReason = '请先结束战斗与结算';
      }
      return {
        build,
        progress: active?.sect ?? null,
        characterLevel: combatCharacterLevel(character.realm, character.stage),
        resources: {
          spiritStones: character.stones,
          cultivationExp: character.cultivationExp,
          comprehensionInsight: character.comprehensionInsight,
        },
        blockedReason,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

export async function mutateSectV6(owner: string, action: SectV6Action) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'sect-v6',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        await assertInventoryIdle(owner);
        const build = await readActiveSectCombatProgress(owner, tx);
        if (
          !build ||
          build.membershipId !== action.membershipId ||
          build.revision !== action.expectedRevision
        )
          throw new InventoryError('宗门构筑已变化，请刷新后重试');
        const character = await characterIdentityRow(owner, tx);
        if (!character) throw new InventoryError('角色不存在');
        const change = sectV6Change(
          build.sect,
          combatCharacterLevel(
            character.realm as RealmType,
            character.realm_stage as RealmStage,
          ),
          action,
        );
        if (
          Object.values(change.cost).some((value) => value > 0) &&
          !(await spendTrainingResources(owner, change.cost, tx))
        )
          throw new InventoryError('修为、灵石或感悟不足');
        const updated = await tx
          .update(sectCombatStates)
          .set({
            revision: build.revision + 1,
            meridianDepth: change.progress.meridianDepth,
            activePathId: change.progress.activePathId,
          })
          .where(
            and(
              eq(sectCombatStates.membershipId, build.membershipId),
              eq(sectCombatStates.revision, action.expectedRevision),
            ),
          )
          .returning({ id: sectCombatStates.membershipId });
        if (!updated.length)
          throw new InventoryError('宗门构筑已变化，请刷新后重试');
        if (action.action === 'train')
          await tx
            .update(sectMethodProgress)
            .set({ level: change.progress.methods[action.methodId] })
            .where(
              and(
                eq(sectMethodProgress.membershipId, build.membershipId),
                eq(sectMethodProgress.methodId, action.methodId),
              ),
            );
        if (action.action === 'save') {
          const [loadout] = await tx
            .update(sectMeridianLoadouts)
            .set({
              revision: change.progress.meridianLoadouts.find(
                (l) => l.pathId === action.pathId,
              )!.revision,
            })
            .where(
              and(
                eq(sectMeridianLoadouts.membershipId, build.membershipId),
                eq(sectMeridianLoadouts.pathId, action.pathId),
              ),
            )
            .returning();
          if (!loadout) throw new InventoryError('经脉方案缺失');
          await tx
            .delete(sectMeridianNodes)
            .where(eq(sectMeridianNodes.loadoutId, loadout.id));
          const path = COMBAT_V6_SECT_DEFINITIONS_V4[
            build.sect.sectId
          ].paths.find((p) => p.id === action.pathId)!;
          if (action.nodeIds.length)
            await tx.insert(sectMeridianNodes).values(
              action.nodeIds.map((nodeId) => ({
                loadoutId: loadout.id,
                nodeId,
                layer: path.nodes.find((n) => n.id === nodeId)!.layer,
              })),
            );
        }
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: character.userId, cultivatorId: owner },
          source: 'combat-v6-sect',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            {
              resourceTopic: 'player.sect-combat',
              operation: 'invalidate',
              eventType: 'combat_v6.sect.changed',
            },
            ...(action.action === 'train' || action.action === 'unlock'
              ? [
                  {
                    resourceTopic: 'player.currency' as const,
                    operation: 'invalidate' as const,
                    eventType: 'combat_v6.sect.cost',
                  },
                  {
                    resourceTopic: 'player.progress' as const,
                    operation: 'invalidate' as const,
                    eventType: 'combat_v6.sect.cost',
                  },
                ]
              : []),
          ],
        });
        lease.assertHeld();
        return { data: { revision: build.revision + 1 }, state };
      }),
  );
}
