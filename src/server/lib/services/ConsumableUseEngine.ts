import { getExecutor } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import type { Consumable } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { consumeConsumableById } from './cultivatorService';
import { ConsumableRegistry } from './ConsumableRegistry';

function mapConsumableRow(
  row: typeof schema.consumables.$inferSelect,
): Consumable {
  return ConsumableRegistry.normalizeConsumable({
    id: row.id,
    name: row.name,
    type: row.type as Consumable['type'],
    quality: row.quality as Consumable['quality'],
    quantity: row.quantity,
    description: row.description || undefined,
    prompt: row.prompt || undefined,
    score: row.score || 0,
    category: (row.category as Consumable['category']) || undefined,
    mechanicKey: row.mechanicKey || undefined,
    quotaKind: (row.quotaKind as Consumable['quotaKind']) || undefined,
    useSpec: (row.useSpec as Consumable['useSpec']) || undefined,
    details: (row.details as Record<string, unknown>) || undefined,
  });
}

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
    _userId: string,
    _cultivatorId: string,
    _consumableId: string,
  ): Promise<{
    message: string;
    consumable: Consumable;
  }> {
    throw new Error('丹药系统重构中，当前版本暂不开放背包内直接服用。');
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
    if (consumable.category !== 'talisman_key') {
      throw new Error('该物品并非会话型符箓');
    }
    if (consumable.useSpec?.talisman?.scenario !== scenario) {
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
