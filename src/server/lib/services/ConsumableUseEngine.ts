import { getExecutor } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { stripExpCapForStorage } from '@server/utils/cultivationUtils';
import {
  ATTRIBUTE_RESET_TALISMAN_NAME,
  ATTRIBUTE_RESET_TALISMAN_SCENARIO,
} from '@shared/config/attributeResetTalisman';
import {
  QI_RESTORE_TALISMAN_SCENARIOS,
  isQiRestoreTalismanScenario,
} from '@shared/config/qiSystem';
import {
  isPillConsumable,
  isTalismanConsumable,
} from '@shared/lib/consumables';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import { getAttributeLabel } from '@shared/lib/gameConceptDisplay';
import type { Consumable } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import {
  consumeConsumableById,
  getPlayerRuntimeCultivatorById,
  replaceSpiritualRoots,
} from './cultivatorService';
import { PillOperationExecutor } from './PillOperationExecutor';
import { QiService } from './QiService';
import { mapConsumableRow } from './consumablePersistence';
import { randomUUID } from 'crypto';
import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  AttributeResetService,
  withAttributeResetLock,
} from './AttributeResetService';

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

function describeTrackLevelUp(levelUp: {
  track: Parameters<typeof getTrackConfig>[0];
  newLevel: number;
}): string {
  const config = getTrackConfig(levelUp.track);

  if (config.reward.kind === 'body_modifier') {
    return `${config.name}提升至 Lv.${levelUp.newLevel}，肉身修正已生效`;
  }

  if (config.reward.kind === 'attribute') {
    return `${config.name}提升至 Lv.${levelUp.newLevel}，${getAttributeLabel(
      config.reward.attribute,
    )} +${config.reward.amount}`;
  }

  if (config.reward.kind === 'none' && levelUp.track === 'marrow_wash') {
    return `${config.name}提升至 Lv.${levelUp.newLevel}，自由属性点 +1`;
  }

  if (config.reward.kind === 'none') {
    return `${config.name}提升至 Lv.${levelUp.newLevel}`;
  }

  return `${config.name}提升至 Lv.${levelUp.newLevel}，所有灵根 +${config.reward.amount}`;
}

export const ConsumableUseEngine = {
  async consume(
    userId: string,
    cultivatorId: string,
    consumableId: string,
    options: { tx?: DbTransaction } = {},
  ): Promise<{
    message: string;
    consumable: Consumable;
  }> {
    const cultivator = await getPlayerRuntimeCultivatorById(userId, cultivatorId);
    if (!cultivator) {
      throw new Error('角色不存在或无权限操作。');
    }

    const consumable = await loadOwnedConsumable(cultivatorId, consumableId);
    if (!consumable) {
      throw new Error('该消耗品不存在或已耗尽。');
    }

    if (isTalismanConsumable(consumable)) {
      if (consumable.spec.scenario === ATTRIBUTE_RESET_TALISMAN_SCENARIO) {
        if (consumable.spec.sessionMode !== 'consume_on_action') {
          throw new Error(
            `该${ATTRIBUTE_RESET_TALISMAN_NAME}需直接启封，不能在会话中锁定。`,
          );
        }

        await withAttributeResetLock(cultivatorId, () =>
          AttributeResetService.resetAttributesWithTalisman({
            userId,
            cultivatorId,
            consumableId,
            tx: options.tx,
          }),
        );

        return {
          message: `已使用${consumable.name}，五维根基归于自然成长，可分配属性点已返还。`,
          consumable,
        };
      }

      if (!isQiRestoreTalismanScenario(consumable.spec.scenario)) {
        throw new Error('符箓需在对应玩法入口校验并消耗，不能在背包中直接使用。');
      }

      if (consumable.spec.sessionMode !== 'consume_on_action') {
        throw new Error('该符箓需在对应玩法入口校验并消耗，不能在背包中直接使用。');
      }

      const restoreSpec = QI_RESTORE_TALISMAN_SCENARIOS[consumable.spec.scenario];
      const restore = async (tx: DbTransaction) => {
        const result = await QiService.restoreQi({
          cultivatorId,
          amount: restoreSpec.amount,
          source: 'talisman',
          action: consumable.spec.scenario,
          actionInstanceId: randomUUID(),
          tx,
          metadata: {
            consumableId,
            consumableName: consumable.name,
            scenario: consumable.spec.scenario,
          },
        });

        await consumeConsumableById(userId, cultivatorId, consumableId, 1, tx);
        return result;
      };
      const restored = options.tx
        ? await restore(options.tx)
        : await getExecutor().transaction(restore);

      return {
        message: `已使用${consumable.name}，天地灵气 +${restored.restored}。`,
        consumable,
      };
    }

    if (!isPillConsumable(consumable)) {
      throw new Error('该消耗品缺少有效丹药 spec。');
    }

    const execution = PillOperationExecutor.execute(cultivator, consumable);
    const nextCultivator = execution.cultivator;
    const lifespanGain = Math.max(
      0,
      Math.floor(nextCultivator.lifespan) - Math.floor(cultivator.lifespan),
    );

    const persistPillEffect = async (tx: DbTransaction) => {
      await tx
        .update(schema.cultivators)
        .set({
          lifespan: Math.round(nextCultivator.lifespan),
          vitality: Math.round(nextCultivator.attributes.vitality),
          spirit: Math.round(nextCultivator.attributes.spirit),
          wisdom: Math.round(nextCultivator.attributes.wisdom),
          speed: Math.round(nextCultivator.attributes.speed),
          willpower: Math.round(nextCultivator.attributes.willpower),
          unallocatedAttributePoints:
            Math.round(nextCultivator.unallocated_attribute_points ?? 0),
          cultivation_progress: nextCultivator.cultivation_progress
            ? stripExpCapForStorage(nextCultivator.cultivation_progress)
            : null,
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
    };

    if (options.tx) {
      await persistPillEffect(options.tx);
    } else {
      await getExecutor().transaction(persistPillEffect);
    }

    const trackMessage =
      execution.trackLevelUps.length > 0
        ? ` ${execution.trackLevelUps
            .map(describeTrackLevelUp)
            .join('，')}。`
        : '';
    const lifespanMessage = lifespanGain > 0 ? ` 寿元 +${lifespanGain} 年。` : '';

    return {
      message:
        `${consumable.name}已服下，药力已经入体。${lifespanMessage}${trackMessage}`.trim(),
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
