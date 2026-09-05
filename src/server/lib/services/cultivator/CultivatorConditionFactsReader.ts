import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { readCombatV6ConditionAuthority } from '../combat-v6/CombatV6ConditionAuthority';
import { loadCultivatorSectState } from '@server/lib/repositories/sectRepository';
import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import type { CultivatorDisplayInput } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type {
  CultivationProgress,
  Cultivator,
} from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import {
  getCultivatorPreHeavenFates,
  mapSpiritualRoots,
} from './CultivatorProfileRepository';
import { mapLoadoutFromProducts } from './CultivatorLoadoutReader';

function activeOwnedCultivatorFilter(userId: string, cultivatorId: string) {
  return and(
    eq(schema.cultivators.id, cultivatorId),
    eq(schema.cultivators.userId, userId),
    eq(schema.cultivators.status, 'active'),
  );
}

export async function loadPlayerRetreatFacts(
  userId: string,
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
) {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      realm: schema.cultivators.realm,
      realmStage: schema.cultivators.realm_stage,
      age: schema.cultivators.age,
      lifespan: schema.cultivators.lifespan,
      closedDoorYearsTotal: schema.cultivators.closedDoorYearsTotal,
      vitality: schema.cultivators.vitality,
      strength: schema.cultivators.strength,
      spirit: schema.cultivators.spirit,
      endurance: schema.cultivators.endurance,
      speed: schema.cultivators.speed,
      willpower: schema.cultivators.willpower,
      unallocatedAttributePoints:
        schema.cultivators.unallocatedAttributePoints,
      condition: schema.cultivators.condition,
      cultivationProgress: schema.cultivators.cultivation_progress,
    })
    .from(schema.cultivators)
    .where(activeOwnedCultivatorFilter(userId, cultivatorId))
    .limit(1);
  if (!row) return null;

  const [roots, fates, sect, gongfa, artifacts] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(schema.spiritualRoots)
        .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId)),
    () => getCultivatorPreHeavenFates(cultivatorId, q),
    () => loadCultivatorSectState(cultivatorId, q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'gongfa', q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'artifact', q),
  ]);
  const loadout = mapLoadoutFromProducts([gongfa, artifacts]);
  const combatV6ResourceAuthority = await readCombatV6ConditionAuthority(cultivatorId, q);
  return {
    ...{ combatV6ResourceAuthority },
    id: row.id,
    name: row.name,
    realm: row.realm as RealmType,
    realm_stage: row.realmStage as RealmStage,
    age: row.age,
    lifespan: row.lifespan,
    closed_door_years_total: row.closedDoorYearsTotal ?? 0,
    attributes: {
      vitality: row.vitality,
      strength: row.strength,
      spirit: row.spirit,
      endurance: row.endurance,
      speed: row.speed,
      willpower: row.willpower,
    },
    unallocated_attribute_points: row.unallocatedAttributePoints ?? 0,
    spiritual_roots: mapSpiritualRoots(roots),
    pre_heaven_fates: fates,
    cultivation_progress: getOrInitCultivationProgress(
      (row.cultivationProgress ?? {}) as CultivationProgress,
      row.realm as RealmType,
      row.realmStage as RealmStage,
    ),
    condition:
      (row.condition as CultivatorCondition | null | undefined) ?? undefined,
    cultivations: loadout.cultivations,
    equipped: loadout.equipped,
    inventory: { artifacts: loadout.artifacts },
    sect,
  };
}

export async function loadPlayerInnRecoveryFacts(
  userId: string,
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<
  | (CultivatorDisplayInput &
      Pick<
        Cultivator,
        'pre_heaven_fates' | 'cultivation_progress' | 'spirit_stones'
      >)
  | null
> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      realm: schema.cultivators.realm,
      realmStage: schema.cultivators.realm_stage,
      vitality: schema.cultivators.vitality,
      strength: schema.cultivators.strength,
      spirit: schema.cultivators.spirit,
      endurance: schema.cultivators.endurance,
      speed: schema.cultivators.speed,
      willpower: schema.cultivators.willpower,
      condition: schema.cultivators.condition,
      cultivationProgress: schema.cultivators.cultivation_progress,
      spiritStones: schema.cultivators.spirit_stones,
    })
    .from(schema.cultivators)
    .where(activeOwnedCultivatorFilter(userId, cultivatorId))
    .limit(1);
  if (!row) return null;

  const [fates, sect, gongfa, artifacts] = await runDbTasks(q, [
    () => getCultivatorPreHeavenFates(cultivatorId, q),
    () => loadCultivatorSectState(cultivatorId, q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'gongfa', q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'artifact', q),
  ]);
  const loadout = mapLoadoutFromProducts([gongfa, artifacts]);
  const combatV6ResourceAuthority = await readCombatV6ConditionAuthority(cultivatorId, q);
  return {
    ...{ combatV6ResourceAuthority },
    id: row.id,
    name: row.name,
    realm: row.realm as RealmType,
    realm_stage: row.realmStage as RealmStage,
    attributes: {
      vitality: row.vitality,
      strength: row.strength,
      spirit: row.spirit,
      endurance: row.endurance,
      speed: row.speed,
      willpower: row.willpower,
    },
    condition:
      (row.condition as CultivatorCondition | null | undefined) ?? undefined,
    cultivation_progress: getOrInitCultivationProgress(
      (row.cultivationProgress ?? {}) as CultivationProgress,
      row.realm as RealmType,
      row.realmStage as RealmStage,
    ),
    spirit_stones: row.spiritStones,
    pre_heaven_fates: fates,
    cultivations: loadout.cultivations,
    equipped: loadout.equipped,
    inventory: { artifacts: loadout.artifacts },
    sect,
  };
}

export async function loadPlayerConsumableOperationFacts(
  userId: string,
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
) {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      realm: schema.cultivators.realm,
      realmStage: schema.cultivators.realm_stage,
      lifespan: schema.cultivators.lifespan,
      vitality: schema.cultivators.vitality,
      strength: schema.cultivators.strength,
      spirit: schema.cultivators.spirit,
      endurance: schema.cultivators.endurance,
      speed: schema.cultivators.speed,
      willpower: schema.cultivators.willpower,
      unallocatedAttributePoints:
        schema.cultivators.unallocatedAttributePoints,
      condition: schema.cultivators.condition,
      cultivationProgress: schema.cultivators.cultivation_progress,
    })
    .from(schema.cultivators)
    .where(activeOwnedCultivatorFilter(userId, cultivatorId))
    .limit(1);
  if (!row) return null;

  const [roots, fates, sect, gongfa, artifacts] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(schema.spiritualRoots)
        .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId)),
    () => getCultivatorPreHeavenFates(cultivatorId, q),
    () => loadCultivatorSectState(cultivatorId, q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'gongfa', q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'artifact', q),
  ]);
  const loadout = mapLoadoutFromProducts([gongfa, artifacts]);
  const combatV6ResourceAuthority = await readCombatV6ConditionAuthority(cultivatorId, q);
  return {
    ...{ combatV6ResourceAuthority },
    id: row.id,
    name: row.name,
    realm: row.realm as RealmType,
    realm_stage: row.realmStage as RealmStage,
    lifespan: row.lifespan,
    attributes: {
      vitality: row.vitality,
      strength: row.strength,
      spirit: row.spirit,
      endurance: row.endurance,
      speed: row.speed,
      willpower: row.willpower,
    },
    unallocated_attribute_points: row.unallocatedAttributePoints ?? 0,
    spiritual_roots: mapSpiritualRoots(roots),
    pre_heaven_fates: fates,
    cultivation_progress: getOrInitCultivationProgress(
      (row.cultivationProgress ?? {}) as CultivationProgress,
      row.realm as RealmType,
      row.realmStage as RealmStage,
    ),
    condition:
      (row.condition as CultivatorCondition | null | undefined) ?? undefined,
    cultivations: loadout.cultivations,
    equipped: loadout.equipped,
    inventory: { artifacts: loadout.artifacts },
    sect,
  };
}
