import { REALM_PILL_USAGE_LIMITS } from '@/config/consumableSystem';
import { getExecutor, type DbTransaction } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import type { Consumable } from '@/types/cultivator';
import type { Cultivator } from '@/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { getOrInitCultivationProgress } from '@/utils/cultivationUtils';
import {
  consumeConsumableById,
  getCultivatorByIdUnsafe,
  replaceSpiritualRoots,
} from './cultivatorService';
import { ConsumableRegistry } from './ConsumableRegistry';
import { PersistentStateService } from './PersistentStateService';

const LONG_TERM_PILL_CATEGORIES = new Set([
  'cultivation',
  'breakthrough',
  'permanent_attribute',
  'marrow_wash',
]);

function cloneCultivatorState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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

function increaseRealmQuota(
  cultivator: Cultivator,
  increment: number,
): Cultivator['persistent_state'] {
  const state = cultivator.persistent_state ?? {};
  const currentRealm = cultivator.realm;
  const currentUsage = state.realmPillUsage?.[currentRealm] ?? 0;

  return {
    ...state,
    realmPillUsage: {
      ...(state.realmPillUsage ?? {}),
      [currentRealm]: currentUsage + increment,
    },
  };
}

function applyPermanentAttributeDelta(
  cultivator: Cultivator,
  consumable: Consumable,
): Cultivator['attributes'] {
  const nextAttributes = { ...cultivator.attributes };
  const delta = consumable.useSpec?.attributeDelta ?? {};

  for (const key of Object.keys(delta) as Array<keyof typeof nextAttributes>) {
    nextAttributes[key] += Math.max(0, Math.floor(delta[key] ?? 0));
  }

  return nextAttributes;
}

function applyMarrowWash(cultivator: Cultivator, consumable: Consumable) {
  const roots = cloneCultivatorState(cultivator.spiritual_roots);
  const spec = consumable.useSpec?.spiritualRootDelta;
  if (!spec) return roots;

  const mode = spec.mode ?? 'all';
  const amount = Math.max(0, Math.floor(spec.amount));
  const cap = spec.cap ?? 100;
  if (amount <= 0) return roots;

  const sorted = [...roots].sort((left, right) => right.strength - left.strength);
  let targets = roots;

  if (mode === 'highest') {
    const target = sorted[0];
    targets = target ? [target] : [];
  } else if (mode === 'lowest') {
    const target = [...sorted].reverse()[0];
    targets = target ? [target] : [];
  }

  const targetKeys = new Set(targets.map((root) => `${root.element}:${root.grade ?? ''}`));
  return roots.map((root) => {
    if (!targetKeys.has(`${root.element}:${root.grade ?? ''}`)) {
      return root;
    }
    return {
      ...root,
      strength: Math.min(cap, root.strength + amount),
    };
  });
}

function buildUseMessage(consumable: Consumable): string {
  switch (consumable.category) {
    case 'healing':
      return `${consumable.name}化开药力，伤势与气血有所回稳。`;
    case 'mana':
      return `${consumable.name}入腹后灵机流转，真元恢复了几分。`;
    case 'cultivation':
      return `${consumable.name}化作绵长药力，修为积累又进了一步。`;
    case 'breakthrough':
      return `${consumable.name}压住瓶颈躁意，为后续破关蓄了一线胜机。`;
    case 'permanent_attribute':
      return `${consumable.name}沉入道体根骨，留下了可长可久的增益。`;
    case 'marrow_wash':
      return `${consumable.name}洗练经脉灵根，资质底子被重新打磨。`;
    case 'detox':
      return `${consumable.name}化去体内丹毒，气机顿时顺畅了许多。`;
    case 'poison_control':
      return `${consumable.name}暂时镇住毒性反噬，脏腑压力减轻了。`;
    default:
      return `${consumable.name}已经使用。`;
  }
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
    userId: string,
    cultivatorId: string,
    consumableId: string,
  ): Promise<{
    message: string;
    consumable: Consumable;
  }> {
    const bundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!bundle || bundle.userId !== userId) {
      throw new Error('角色不存在或无权限操作');
    }

    const cultivator = cloneCultivatorState(bundle.cultivator);
    const consumable = await loadOwnedConsumable(cultivatorId, consumableId);
    if (!consumable) {
      throw new Error('消耗品不存在或已被耗尽');
    }

    if (!consumable.category || !consumable.useSpec) {
      throw new Error('该消耗品仍是旧制数据，暂未开放新版本使用。');
    }

    if (consumable.category === 'talisman_key') {
      throw new Error('此符箓需前往对应玩法页中消耗，不能在背包中直接使用。');
    }

    const now = new Date();
    const hydrated = PersistentStateService.applyNaturalRecovery(
      cultivator,
      cultivator.persistent_state,
      cultivator.persistent_statuses,
      now,
    );

    cultivator.persistent_state = hydrated.state;
    cultivator.persistent_statuses = hydrated.statuses;

    const countsTowardsQuota =
      consumable.quotaKind === 'long_term_pill' ||
      LONG_TERM_PILL_CATEGORIES.has(consumable.category);

    if (countsTowardsQuota) {
      const used = cultivator.persistent_state?.realmPillUsage?.[cultivator.realm] ?? 0;
      const limit = REALM_PILL_USAGE_LIMITS[cultivator.realm];
      if (used >= limit) {
        throw new Error(
          `${cultivator.realm}境长期丹药服用次数已满（${used}/${limit}），需待突破后方可继续服药。`,
        );
      }
    }

    const nextProgress = getOrInitCultivationProgress(
      cloneCultivatorState(
        (cultivator.cultivation_progress ?? {}) as NonNullable<
          Cultivator['cultivation_progress']
        >,
      ),
      cultivator.realm,
      cultivator.realm_stage,
    );
    let nextAttributes = cloneCultivatorState(cultivator.attributes);
    let nextRoots = cloneCultivatorState(cultivator.spiritual_roots);
    let nextState = cloneCultivatorState(cultivator.persistent_state);
    let nextStatuses = cloneCultivatorState(cultivator.persistent_statuses);

    if (consumable.category === 'healing' || consumable.category === 'mana') {
      const result = PersistentStateService.applyConsumableRecovery(
        cultivator,
        nextState,
        nextStatuses,
        consumable.useSpec,
        now,
      );
      nextState = result.state;
      nextStatuses = result.statuses;
    } else if (
      consumable.category === 'detox' ||
      consumable.category === 'poison_control'
    ) {
      const result = PersistentStateService.applyConsumableRecovery(
        cultivator,
        nextState,
        nextStatuses,
        consumable.useSpec,
        now,
      );
      nextState = result.state;
      nextStatuses = result.statuses;
    } else if (consumable.category === 'cultivation') {
      nextProgress.cultivation_exp = Math.min(
        nextProgress.exp_cap,
        nextProgress.cultivation_exp +
          Math.max(0, Math.floor(consumable.useSpec.cultivationExpGain ?? 0)),
      );
      nextProgress.comprehension_insight = Math.min(
        100,
        nextProgress.comprehension_insight +
          Math.max(
            0,
            Math.floor(consumable.useSpec.comprehensionInsightGain ?? 0),
          ),
      );
      nextState = PersistentStateService.addPillToxicity(
        cultivator,
        nextState,
        Math.max(0, Math.floor(consumable.useSpec.toxicityDelta ?? 0)),
        now,
      );
    } else if (consumable.category === 'breakthrough') {
      nextProgress.comprehension_insight = Math.min(
        100,
        nextProgress.comprehension_insight +
          Math.max(
            0,
            Math.floor(consumable.useSpec.comprehensionInsightGain ?? 0),
          ),
      );
      nextState = {
        ...PersistentStateService.addPillToxicity(
          cultivator,
          nextState,
          Math.max(0, Math.floor(consumable.useSpec.toxicityDelta ?? 0)),
          now,
        ),
        pendingBreakthroughBonus: Math.max(
          nextState?.pendingBreakthroughBonus ?? 0,
          consumable.useSpec.breakthroughChanceBonus ?? 0,
        ),
      };
    } else if (consumable.category === 'permanent_attribute') {
      nextAttributes = applyPermanentAttributeDelta(cultivator, consumable);
      nextState = PersistentStateService.addPillToxicity(
        cultivator,
        nextState,
        Math.max(0, Math.floor(consumable.useSpec.toxicityDelta ?? 0)),
        now,
      );
    } else if (consumable.category === 'marrow_wash') {
      nextRoots = applyMarrowWash(cultivator, consumable);
      nextState = PersistentStateService.addPillToxicity(
        cultivator,
        nextState,
        Math.max(0, Math.floor(consumable.useSpec.toxicityDelta ?? 0)),
        now,
      );
    }

    if (countsTowardsQuota) {
      cultivator.persistent_state = increaseRealmQuota(
        {
          ...cultivator,
          persistent_state: nextState,
        },
        1,
      );
      nextState = cultivator.persistent_state ?? nextState;
    }

    await getExecutor().transaction(async (tx: DbTransaction) => {
      await consumeConsumableById(userId, cultivatorId, consumableId, 1, tx);
      await tx
        .update(schema.cultivators)
        .set({
          vitality: Math.round(nextAttributes.vitality),
          spirit: Math.round(nextAttributes.spirit),
          wisdom: Math.round(nextAttributes.wisdom),
          speed: Math.round(nextAttributes.speed),
          willpower: Math.round(nextAttributes.willpower),
          cultivation_progress: nextProgress,
          persistent_state: nextState ?? {},
          persistent_statuses: nextStatuses ?? [],
        })
        .where(eq(schema.cultivators.id, cultivatorId));

      const rootsChanged =
        JSON.stringify(nextRoots) !== JSON.stringify(cultivator.spiritual_roots);
      if (rootsChanged) {
        await replaceSpiritualRoots(userId, cultivatorId, nextRoots, tx);
      }
    });

    return {
      message: buildUseMessage(consumable),
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
      { nx: true, ex: 3600 },
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
    const lock = await redis.get<{ cultivatorId: string; consumableId: string }>(
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
