import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import {
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock';
import { consumeConsumableById } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import {
  ATTRIBUTE_RESET_TALISMAN_NAME,
  ATTRIBUTE_RESET_TALISMAN_SCENARIO,
} from '@shared/config/attributeResetTalisman';
import { getRealmStageNaturalAttributeValue } from '@shared/config/realmProgression';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { Attributes } from '@shared/types/cultivator';
import { eq } from 'drizzle-orm';
import { findBagTalisman } from './BagConsumables';

export class AttributeResetServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AttributeResetServiceError';
  }
}

export interface AttributeResetResult {
  attributes: Attributes;
  unallocated_attribute_points: number;
  refunded_attribute_points: number;
  consumed_talisman_name: string;
}

export function getAttributeResetLockKey(cultivatorId: string): string {
  return redisLockKeys.cultivatorMutation(cultivatorId);
}

export async function withAttributeResetLock<T>(
  cultivatorId: string,
  task: (lease: RedisLeaseContext) => Promise<T>,
  lease?: RedisLeaseContext,
): Promise<T> {
  if (lease) {
    lease.assertHeld();
    const result = await task(lease);
    lease.assertHeld();
    return result;
  }

  return withRedisLock(
    {
      key: getAttributeResetLockKey(cultivatorId),
      context: 'attribute-reset',
      retries: 0,
      delayMs: 50,
    },
    async (lease) => {
      lease.assertHeld();
      return task(lease);
    },
  );
}

async function loadResetTalisman(args: {
  cultivatorId: string;
  consumableId?: string;
  tx?: DbTransaction;
}) {
  return (
    await findBagTalisman(
      args.cultivatorId,
      ATTRIBUTE_RESET_TALISMAN_SCENARIO,
      getExecutor(args.tx),
      args.consumableId,
    )
  ).find(
    (item) =>
      item.spec.kind === 'talisman' &&
      item.spec.sessionMode === 'consume_on_action',
  );
}

export const AttributeResetService = {
  async resetAttributesWithTalisman(args: {
    userId: string;
    cultivatorId: string;
    consumableId?: string;
    tx?: DbTransaction;
  }): Promise<AttributeResetResult> {
    const q = getExecutor(args.tx);
    const [current] = await q
      .select({
        id: schema.cultivators.id,
        realm: schema.cultivators.realm,
        realmStage: schema.cultivators.realm_stage,
        vitality: schema.cultivators.vitality,
        strength: schema.cultivators.strength,
        spirit: schema.cultivators.spirit,
        endurance: schema.cultivators.endurance,
        speed: schema.cultivators.speed,
        willpower: schema.cultivators.willpower,
        unallocatedAttributePoints:
          schema.cultivators.unallocatedAttributePoints,
      })
      .from(schema.cultivators)
      .where(eq(schema.cultivators.id, args.cultivatorId))
      .limit(1);

    if (!current) {
      throw new AttributeResetServiceError(404, '角色不存在');
    }

    const talismanRow = await loadResetTalisman({
      cultivatorId: args.cultivatorId,
      consumableId: args.consumableId,
      tx: args.tx,
    });
    if (!talismanRow?.id) {
      throw new AttributeResetServiceError(
        400,
        `缺少${ATTRIBUTE_RESET_TALISMAN_NAME}，无法重置根基属性`,
      );
    }

    const naturalAttributeValue = getRealmStageNaturalAttributeValue(
      current.realm as RealmType,
      current.realmStage as RealmStage,
    );
    const currentTotal =
      current.vitality +
      current.strength +
      current.spirit +
      current.endurance +
      current.speed +
      current.willpower;
    const refundedAttributePoints = Math.max(
      0,
      currentTotal - naturalAttributeValue * 6,
    );

    if (refundedAttributePoints <= 0) {
      throw new AttributeResetServiceError(400, '当前没有已分配的属性点可重置');
    }

    const nextAttributes = {
      vitality: naturalAttributeValue,
      strength: naturalAttributeValue,
      spirit: naturalAttributeValue,
      endurance: naturalAttributeValue,
      speed: naturalAttributeValue,
      willpower: naturalAttributeValue,
    };
    const [updated] = await q
      .update(schema.cultivators)
      .set({
        ...nextAttributes,
        unallocatedAttributePoints:
          current.unallocatedAttributePoints + refundedAttributePoints,
      })
      .where(eq(schema.cultivators.id, args.cultivatorId))
      .returning({
        vitality: schema.cultivators.vitality,
        strength: schema.cultivators.strength,
        spirit: schema.cultivators.spirit,
        endurance: schema.cultivators.endurance,
        speed: schema.cultivators.speed,
        willpower: schema.cultivators.willpower,
        unallocatedAttributePoints:
          schema.cultivators.unallocatedAttributePoints,
      });

    await consumeConsumableById(
      args.userId,
      args.cultivatorId,
      talismanRow.id,
      1,
      args.tx,
    );

    return {
      attributes: {
        vitality: updated.vitality,
        strength: updated.strength,
        spirit: updated.spirit,
        endurance: updated.endurance,
        speed: updated.speed,
        willpower: updated.willpower,
      },
      unallocated_attribute_points: updated.unallocatedAttributePoints,
      refunded_attribute_points: refundedAttributePoints,
      consumed_talisman_name: talismanRow.name,
    };
  },
};
