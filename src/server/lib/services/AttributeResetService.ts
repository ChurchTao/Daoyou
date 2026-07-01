import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import {
  createRedisLock,
  releaseRedisLock,
} from '@server/lib/redis/lock';
import {
  ATTRIBUTE_RESET_TALISMAN_NAME,
  ATTRIBUTE_RESET_TALISMAN_SCENARIO,
} from '@shared/config/attributeResetTalisman';
import { getRealmStageNaturalAttributeValue } from '@shared/config/realmProgression';
import { isTalismanConsumable } from '@shared/lib/consumables';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { Attributes } from '@shared/types/cultivator';
import { and, asc, eq } from 'drizzle-orm';
import { consumeConsumableById } from './cultivatorService';
import { mapConsumableRow } from './consumablePersistence';

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
  return `cultivator:attributes:reset:lock:${cultivatorId}`;
}

export async function withAttributeResetLock<T>(
  cultivatorId: string,
  task: () => Promise<T>,
): Promise<T> {
  const lockKey = getAttributeResetLockKey(cultivatorId);
  const lock = createRedisLock({
    retries: 0,
    delay: 50,
  });
  let lockAcquired = false;

  try {
    await lock.acquire(lockKey);
    lockAcquired = true;
    return await task();
  } finally {
    if (lockAcquired) {
      await releaseRedisLock(lock, lockKey);
    }
  }
}

async function loadResetTalisman(args: {
  cultivatorId: string;
  consumableId?: string;
  tx?: DbTransaction;
}) {
  const q = getExecutor(args.tx);
  const conditions = [
    eq(schema.consumables.cultivatorId, args.cultivatorId),
    eq(schema.consumables.type, '符箓'),
  ];
  if (args.consumableId) {
    conditions.push(eq(schema.consumables.id, args.consumableId));
  }

  const rows = await q
    .select()
    .from(schema.consumables)
    .where(and(...conditions))
    .orderBy(asc(schema.consumables.createdAt))
    .limit(args.consumableId ? 1 : 100);

  return rows.find((row) => {
    if (row.quantity <= 0) return false;
    const consumable = mapConsumableRow(row);
    return (
      isTalismanConsumable(consumable) &&
      consumable.spec.scenario === ATTRIBUTE_RESET_TALISMAN_SCENARIO &&
      consumable.spec.sessionMode === 'consume_on_action'
    );
  });
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
        spirit: schema.cultivators.spirit,
        wisdom: schema.cultivators.wisdom,
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
      current.spirit +
      current.wisdom +
      current.speed +
      current.willpower;
    const refundedAttributePoints = Math.max(
      0,
      currentTotal - naturalAttributeValue * 5,
    );

    if (refundedAttributePoints <= 0) {
      throw new AttributeResetServiceError(
        400,
        '当前没有已分配的属性点可重置',
      );
    }

    const nextAttributes = {
      vitality: naturalAttributeValue,
      spirit: naturalAttributeValue,
      wisdom: naturalAttributeValue,
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
        spirit: schema.cultivators.spirit,
        wisdom: schema.cultivators.wisdom,
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
        spirit: updated.spirit,
        wisdom: updated.wisdom,
        speed: updated.speed,
        willpower: updated.willpower,
      },
      unallocated_attribute_points: updated.unallocatedAttributePoints,
      refunded_attribute_points: refundedAttributePoints,
      consumed_talisman_name: talismanRow.name,
    };
  },
};
