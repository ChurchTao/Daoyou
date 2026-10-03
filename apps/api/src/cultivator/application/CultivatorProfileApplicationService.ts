import {
  breakthroughHistory,
  cultivators,
} from '@server/lib/drizzle/schema.js';
import { invalidateActiveCultivatorRef } from '@server/lib/auth/activeCultivator.js';
import {
  redisLockKeys,
  withRedisLock,
} from '@server/lib/redis/lock.js';
import {
  getRealmStageNaturalAttributeValue,
  getRealmStageUnallocatedAttributeBudget,
} from '@daoyou/shared/config/realmProgression';
import type { ResourceChangeDescriptor } from '@daoyou/shared/contracts/resources';
import type { RealmStage, RealmType } from '@daoyou/shared/types/constants';
import { and, eq } from 'drizzle-orm';
import {
  AttributeResetService,
  withAttributeResetLock,
} from '@server/cultivator/application/AttributeResetService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import {
  deleteCultivator,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';

type Actor = {
  userId: string;
  cultivatorId: string;
};

const profilePatch = (
  eventType: string,
  cultivator: Record<string, unknown>,
): ResourceChangeDescriptor[] => [
  {
    resourceTopic: 'player.profile',
    eventType,
    payload: { cultivator },
    operation: 'merge',
  },
];

export function deleteCultivatorCommand(args: {
  userId: string;
  cultivatorId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'cultivator-delete',
      timeoutMs: 15_000,
      retries: 0,
    },
    async (lease) => {
      lease.assertHeld();
      const deleted = await deleteCultivator(args.userId, args.cultivatorId);
      if (deleted) {
        await invalidateActiveCultivatorRef(args.userId);
      }
      return deleted;
    },
  );
}

export async function reincarnateActiveCultivator(args: {
  actor: Actor;
}) {
  const committed = await playerCommandExecutor.executeWithLock({
    userId: args.actor.userId,
    cultivatorId: args.actor.cultivatorId,
    source: 'active_reincarnate',
    command: async (tx) => {
      const current = await tx.query.cultivators.findFirst({
        columns: {
          name: true,
          status: true,
          realm: true,
          realm_stage: true,
          age: true,
        },
        where: eq(cultivators.id, args.actor.cultivatorId),
      });
      if (!current) throw new Error('角色不存在');
      if (current.status === 'dead') {
        throw new Error('该角色已身死道消');
      }
      const [updated] = await tx
        .update(cultivators)
        .set({ status: 'dead', diedAt: new Date() })
        .where(
          and(
            eq(cultivators.id, args.actor.cultivatorId),
            eq(cultivators.status, 'active'),
          ),
        )
        .returning({ id: cultivators.id });
      if (!updated) {
        throw new Error('角色状态已经变化，请刷新后重试');
      }
      await tx.insert(breakthroughHistory).values({
        cultivatorId: args.actor.cultivatorId,
        from_realm: current.realm,
        from_stage: current.realm_stage,
        to_realm: '轮回',
        to_stage: '转世',
        age: current.age,
        years_spent: 0,
        story: `道友${current.name}感悟天道无常，寿元虽未尽，然道心已决。遂于今日自行兵解，散去一身修为，只求来世再踏仙途，重证大道。天地为之动容，降下祥云送行。`,
      });
      return {
        result: null,
        resourceChanges: [
          {
            resourceTopic: 'player.profile',
            eventType: 'profile.reincarnated',
            payload: { cultivator: { status: 'dead' } },
            operation: 'merge',
          },
          {
            resourceTopic: 'player.session',
            eventType: 'session.active_cultivator_died',
            payload: { activeCultivator: null, note: '前世道途已尽' },
            operation: 'replace',
          },
        ],
      };
    },
  });
  await invalidateActiveCultivatorRef(args.actor.userId);
  return committed;
}

export function updateCultivatorTitle(args: Actor & { title: string | null }) {
  return playerCommandExecutor.execute({
    coordination: { mode: 'database-only' },
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'profile_title',
    command: async (tx) => {
      const [updated] = await tx
        .update(cultivators)
        .set({ title: args.title })
        .where(eq(cultivators.id, args.cultivatorId))
        .returning();
      return {
        result: updated,
        resourceChanges: profilePatch('profile.title.changed', {
          title: args.title,
        }),
      };
    },
  });
}

type AttributeDelta = {
  vitality: number;
  strength: number;
  spirit: number;
  endurance: number;
  speed: number;
  willpower: number;
};

export async function allocateCultivatorAttributes(args: {
  actor: Actor;
  delta: AttributeDelta;
}) {
  const spent = Object.values(args.delta).reduce(
    (total, value) => total + value,
    0,
  );
  if (spent <= 0) throw new Error('请选择要分配的属性点');
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.actor.cultivatorId),
      context: 'profile-attribute-allocate',
      timeoutMs: 10_000,
      retries: 0,
    },
    (lease) =>
      playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.actor.userId,
        cultivatorId: args.actor.cultivatorId,
        source: 'profile_attribute_allocate',
        command: async (tx) => {
          const [current] = await tx
            .select({
              realm: cultivators.realm,
              realmStage: cultivators.realm_stage,
              vitality: cultivators.vitality,
              strength: cultivators.strength,
              spirit: cultivators.spirit,
              endurance: cultivators.endurance,
              speed: cultivators.speed,
              willpower: cultivators.willpower,
              unallocatedAttributePoints:
                cultivators.unallocatedAttributePoints,
            })
            .from(cultivators)
            .where(eq(cultivators.id, args.actor.cultivatorId));
          if (!current) throw new Error('角色不存在');
          if (spent > current.unallocatedAttributePoints) {
            throw new Error('未分配属性点不足');
          }
          const nextAttributes = {
            vitality: current.vitality + args.delta.vitality,
            strength: current.strength + args.delta.strength,
            spirit: current.spirit + args.delta.spirit,
            endurance: current.endurance + args.delta.endurance,
            speed: current.speed + args.delta.speed,
            willpower: current.willpower + args.delta.willpower,
          };
          const values = Object.values(nextAttributes);
          const naturalAttributeValue = getRealmStageNaturalAttributeValue(
            current.realm as RealmType,
            current.realmStage as RealmStage,
          );
          if (values.some((value) => value < naturalAttributeValue)) {
            throw new Error('属性不能低于当前境界自然值');
          }
          const freeAttributeBudget =
            getRealmStageUnallocatedAttributeBudget(
              current.realm as RealmType,
              current.realmStage as RealmStage,
            );
          const allocatedPoints =
            values.reduce((sum, value) => sum + value, 0) -
            naturalAttributeValue * 6;
          const currentAllocatedPoints =
            current.vitality +
            current.strength +
            current.spirit +
            current.endurance +
            current.speed +
            current.willpower -
            naturalAttributeValue * 6;
          const earnedAttributeBudget = Math.max(
            freeAttributeBudget,
            currentAllocatedPoints + current.unallocatedAttributePoints,
          );
          if (allocatedPoints > earnedAttributeBudget) {
            throw new Error('属性总点数超过当前境界预算');
          }
          const [updated] = await tx
            .update(cultivators)
            .set({
              ...nextAttributes,
              unallocatedAttributePoints:
                current.unallocatedAttributePoints - spent,
            })
            .where(eq(cultivators.id, args.actor.cultivatorId))
            .returning({
              vitality: cultivators.vitality,
              strength: cultivators.strength,
              spirit: cultivators.spirit,
              endurance: cultivators.endurance,
              speed: cultivators.speed,
              willpower: cultivators.willpower,
              unallocated_attribute_points:
                cultivators.unallocatedAttributePoints,
            });
          const result = {
            attributes: {
              vitality: updated.vitality,
              strength: updated.strength,
              spirit: updated.spirit,
              endurance: updated.endurance,
              speed: updated.speed,
              willpower: updated.willpower,
            },
            unallocated_attribute_points:
              updated.unallocated_attribute_points,
          };
          return {
            result,
            resourceChanges: profilePatch(
              'profile.attributes.allocated',
              result,
            ),
          };
        },
      }),
  );
}

export function resetCultivatorAttributes(args: Actor) {
  return withAttributeResetLock(args.cultivatorId, (lease) =>
    playerCommandExecutor.execute({
      coordination: { mode: 'redis', lease },
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      source: 'profile_attribute_reset',
      command: async (tx) => {
        const result =
          await AttributeResetService.resetAttributesWithTalisman({
            userId: args.userId,
            cultivatorId: args.cultivatorId,
            tx,
          });
        return {
          result,
          resourceChanges: profilePatch('profile.attributes.reset', {
            attributes: result.attributes,
            unallocated_attribute_points:
              result.unallocated_attribute_points,
          }),
        };
      },
    }),
  );
}
