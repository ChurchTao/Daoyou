import { getExecutor } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import { isPillConsumable, isTalismanConsumable } from '@shared/lib/consumables';
import type { Consumable } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { consumeConsumableById, getCultivatorById, replaceSpiritualRoots } from './cultivatorService';
import { PillOperationExecutor } from './PillOperationExecutor';
import { mapConsumableRow } from './consumablePersistence';

async function loadOwnedConsumable(
  cultivatorId: string,
  consumableId: string,
): Promise<Consumable | null> {
  const rows = await getExecutor()
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.id, consumableId),
        eq(schema.consumables.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);

  return rows[0] ? mapConsumableRow(rows[0]) : null;
}

export const ConsumableUseEngine = {
  async consume(
    userId: string,
    cultivatorId: string,
    consumableId: string,
  ): Promise<{
    message: string;
    consumable: Consumable;
  }> {
    const cultivator = await getCultivatorById(userId, cultivatorId);
    if (!cultivator) {
      throw new Error('角色不存在或无权限操作。');
    }

    const consumable = await loadOwnedConsumable(cultivatorId, consumableId);
    if (!consumable) {
      throw new Error('该消耗品不存在或已耗尽。');
    }

    if (isTalismanConsumable(consumable)) {
      throw new Error('符箓需在对应玩法入口校验并消耗，不能在背包中直接使用。');
    }

    if (!isPillConsumable(consumable)) {
      throw new Error('该消耗品缺少有效丹药 spec。');
    }

    const execution = PillOperationExecutor.execute(cultivator, consumable);
    const nextCultivator = execution.cultivator;

    await getExecutor().transaction(async (tx) => {
      await tx
        .update(schema.cultivators)
        .set({
          vitality: Math.round(nextCultivator.attributes.vitality),
          spirit: Math.round(nextCultivator.attributes.spirit),
          wisdom: Math.round(nextCultivator.attributes.wisdom),
          speed: Math.round(nextCultivator.attributes.speed),
          willpower: Math.round(nextCultivator.attributes.willpower),
          condition: nextCultivator.condition ?? {},
        })
        .where(eq(schema.cultivators.id, cultivatorId));

      await replaceSpiritualRoots(
        userId,
        cultivatorId,
        nextCultivator.spiritual_roots,
        tx,
      );

      await consumeConsumableById(userId, cultivatorId, consumableId, 1, tx);
    });

    const trackMessage =
      execution.trackLevelUps.length > 0
        ? ` ${execution.trackLevelUps
            .map((item) => `${getTrackConfig(item.track).name}提升至 Lv.${item.newLevel}`)
            .join('，')}。`
        : '';

    return {
      message: `${consumable.name}已服下，药力已经入体。${trackMessage}`.trim(),
      consumable,
    };
  },

  async lockTalismanForSession(options: {
    cultivatorId: string;
    consumableId: string;
    scenario: string;
    sessionId: string;
  }): Promise<void> {
    const { cultivatorId, consumableId, scenario, sessionId } = options;
    const consumable = await loadOwnedConsumable(cultivatorId, consumableId);
    if (!consumable) {
      throw new Error('符箓不存在或已被耗尽');
    }
    if (!isTalismanConsumable(consumable)) {
      throw new Error('该物品并非会话型符箓');
    }
    if (consumable.spec.scenario !== scenario) {
      throw new Error('该符箓无法用于当前玩法');
    }

    const lockKey = `talisman-lock:${scenario}:${sessionId}`;
    const locked = await redis.set(
      lockKey,
      JSON.stringify({
        cultivatorId,
        consumableId,
      }),
      'EX',
      3600,
      'NX',
    );

    if (!locked) {
      throw new Error('该玩法会话的符箓锁定已存在，请勿重复进场');
    }
  },

  async settleTalismanLock(options: {
    userId: string;
    cultivatorId: string;
    scenario: string;
    sessionId: string;
  }): Promise<void> {
    const { userId, cultivatorId, scenario, sessionId } = options;
    const lockKey = `talisman-lock:${scenario}:${sessionId}`;
    const lock = parseRedisJson<{ cultivatorId: string; consumableId: string }>(
      await redis.get(lockKey),
      lockKey,
    );
    if (!lock) {
      throw new Error('未找到待结算的符箓锁定');
    }
    if (lock.cultivatorId !== cultivatorId) {
      throw new Error('符箓锁定归属异常');
    }

    await consumeConsumableById(userId, cultivatorId, lock.consumableId, 1);
    await redis.del(lockKey);
  },

  async releaseTalismanLock(options: {
    scenario: string;
    sessionId: string;
  }): Promise<void> {
    const { scenario, sessionId } = options;
    await redis.del(`talisman-lock:${scenario}:${sessionId}`);
  },
};
