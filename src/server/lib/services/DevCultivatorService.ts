import { allowsLocalDevTools } from '@shared/config/deployment';
import type { DevCultivatorPatch } from '@shared/contracts/devTools';
import { projectCultivatorMultiSectV5ToCombatV6 } from '@shared/engine/combat-v6/projection';
import type { CultivatorCondition } from '@shared/types/condition';
import { and, eq } from 'drizzle-orm';
import { db } from '../drizzle/db';
import { cultivators, sectMemberships } from '../drizzle/schema';
import { redisLockKeys, withRedisLock } from '../redis/lock';
import { ConditionService } from './ConditionService';
import { assertInventoryIdle, InventoryError } from './InventoryService';
import { ResourceEventCommitter } from './ResourceEventCommitter';
import { assembleCombatV6TrainingPlayer } from './combat-v6/CombatV6BuildService';

export async function patchDevCultivator(
  owner: string,
  input: DevCultivatorPatch,
) {
  if (!allowsLocalDevTools(process.env.APP_ENV, process.env.NODE_ENV))
    throw new InventoryError('仅允许纯本地环境使用');
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'dev-cultivator',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(cultivators)
          .where(eq(cultivators.id, owner))
          .for('update');
        if (!before || before.status !== 'active')
          throw new InventoryError('活跃角色不存在');
        await assertInventoryIdle(owner);
        let sect;
        if (input.sect) {
          const [membership] = await tx
            .select()
            .from(sectMemberships)
            .where(
              and(
                eq(sectMemberships.cultivatorId, owner),
                eq(sectMemberships.status, 'active'),
              ),
            )
            .for('update');
          if (!membership) throw new InventoryError('角色尚未加入宗门');
          if (
            (input.sect.contribution ?? membership.contribution) >
            (input.sect.lifetimeContribution ?? membership.lifetimeContribution)
          )
            throw new InventoryError('累计贡献不能小于可用贡献');
          [sect] = await tx
            .update(sectMemberships)
            .set({ ...input.sect, updatedAt: new Date() })
            .where(eq(sectMemberships.id, membership.id))
            .returning({
              membershipId: sectMemberships.id,
              sectId: sectMemberships.sectId,
              discipleRank: sectMemberships.discipleRank,
              contribution: sectMemberships.contribution,
              lifetimeContribution: sectMemberships.lifetimeContribution,
            });
        }
        await tx
          .update(cultivators)
          .set({
            ...(input.realm === undefined ? {} : { realm: input.realm }),
            ...(input.realmStage === undefined
              ? {}
              : { realm_stage: input.realmStage }),
            ...input.attributes,
            ...(input.unallocatedAttributePoints === undefined
              ? {}
              : {
                  unallocatedAttributePoints: input.unallocatedAttributePoints,
                }),
            ...(input.spiritStones === undefined
              ? {}
              : { spirit_stones: input.spiritStones }),
            ...(input.reputation === undefined
              ? {}
              : { reputation: input.reputation }),
            updatedAt: new Date(),
          })
          .where(eq(cultivators.id, owner));
        if (input.resources) {
          const { player } = await assembleCombatV6TrainingPlayer(owner, tx);
          const projected = projectCultivatorMultiSectV5ToCombatV6({
            ...player,
            side: 0,
            slot: 0,
            resourcePolicy: 'full',
          });
          if (!projected.ok) throw new InventoryError('角色 v6 构筑不可用');
          const condition = ConditionService.applyCombatV6Resources(
            before.condition as CultivatorCondition,
            {
              hp: Math.min(input.resources.hp, projected.unit.attrs!.maxHp!),
              mp: Math.min(input.resources.mp, projected.unit.attrs!.maxMp!),
              maxHp: projected.unit.attrs!.maxHp!,
              maxMp: projected.unit.attrs!.maxMp!,
            },
          );
          await tx
            .update(cultivators)
            .set({ condition })
            .where(eq(cultivators.id, owner));
        }
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: before.userId, cultivatorId: owner },
          source: 'dev-cultivator',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            ...(
              [
                'player.profile',
                'player.currency',
                'player.progress',
                'player.condition',
                'player.combat-v6-build',
              ] as const
            ).map((resourceTopic) => ({
              resourceTopic,
              operation: 'invalidate' as const,
              eventType: 'dev.cultivator.changed',
            })),
            ...(sect
              ? [
                  ...(['sect.membership', 'sect.tasks'] as const).map(
                    (resourceTopic) => ({
                      resourceTopic,
                      operation: 'invalidate' as const,
                      eventType: 'dev.sect.changed',
                    }),
                  ),
                  {
                    scope: { kind: 'sect' as const, id: sect.sectId },
                    resourceTopic: 'sect.members' as const,
                    operation: 'invalidate' as const,
                    eventType: 'dev.sect.changed',
                  },
                ]
              : []),
          ],
        });
        lease.assertHeld();
        const [after] = await tx
          .select({
            id: cultivators.id,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
            vitality: cultivators.vitality,
            strength: cultivators.strength,
            spirit: cultivators.spirit,
            endurance: cultivators.endurance,
            speed: cultivators.speed,
            willpower: cultivators.willpower,
            spiritStones: cultivators.spirit_stones,
            reputation: cultivators.reputation,
            unallocatedAttributePoints: cultivators.unallocatedAttributePoints,
          })
          .from(cultivators)
          .where(eq(cultivators.id, owner));
        return { data: { ...after, ...(sect ? { sect } : {}) }, state };
      }),
  );
}
