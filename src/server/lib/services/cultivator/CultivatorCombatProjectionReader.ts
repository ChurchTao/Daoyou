import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { findCultivatorOwnerStatusById } from '@server/lib/repositories/cultivatorRepository';
import { loadCultivatorSectState } from '@server/lib/repositories/sectRepository';
import type { CultivatorInspectionData } from '@shared/contracts/player';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import type { CultivatorDisplayInput } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { CultivatorCondition } from '@shared/types/condition';
import type {
  GenderType,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { ConditionService } from '../ConditionService';
import { readCombatV6ConditionAuthority } from '../combat-v6/CombatV6ConditionAuthority';
import {
  getPlayerLoadoutByCultivatorId,
  mapLoadoutFromProducts,
} from './CultivatorLoadoutReader';
import {
  getCultivatorPreHeavenFates,
  getPlayerIdentityCultivatorById,
  mapSpiritualRoots,
} from './CultivatorProfileRepository';

export interface CultivatorCombatInputWithOwner {
  cultivator: CultivatorCombatInput;
  userId: string;
}

type CultivatorDungeonPromptBaseFacts = Omit<
  CultivatorDisplayInput,
  'cultivations' | 'equipped' | 'inventory'
> &
  Pick<
    Cultivator,
    | 'gender'
    | 'age'
    | 'lifespan'
    | 'personality'
    | 'background'
    | 'spiritual_roots'
    | 'pre_heaven_fates'
    | 'spirit_stones'
  >;

export type CultivatorDungeonPromptFacts = CultivatorDisplayInput &
  CultivatorDungeonPromptBaseFacts;

export type CultivatorTowerRewardFacts = CultivatorDisplayInput &
  Pick<
    Cultivator,
    | 'gender'
    | 'age'
    | 'lifespan'
    | 'personality'
    | 'background'
    | 'spiritual_roots'
    | 'pre_heaven_fates'
    | 'skills'
    | 'spirit_stones'
  >;

export async function loadCultivatorCombatInput(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<CultivatorCombatInputWithOwner | null> {
  const q = executor ?? getExecutor();
  const owner = await findCultivatorOwnerStatusById(cultivatorId, q);
  if (!owner || owner.status !== 'active') return null;
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
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;

  const [roots, fates, sect, loadout] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(schema.spiritualRoots)
        .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId)),
    () => getCultivatorPreHeavenFates(cultivatorId, q),
    () => loadCultivatorSectState(cultivatorId, q),
    () => getPlayerLoadoutByCultivatorId(cultivatorId, q),
  ]);
  const storedCondition =
    (row.condition as CultivatorCondition | null | undefined) ?? undefined;
  const baseInput: CultivatorCombatInput = {
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
    spiritual_roots: mapSpiritualRoots(roots),
    pre_heaven_fates: fates,
    sect,
    skills: loadout.skills,
    cultivations: loadout.cultivations,
    equipped: loadout.equipped,
    inventory: { artifacts: loadout.artifacts },
    condition: storedCondition,
  };
  const combatV6ResourceAuthority = await readCombatV6ConditionAuthority(cultivatorId, q);
  return {
    userId: owner.userId,
    cultivator: {
      ...baseInput,
      condition: ConditionService.normalizeCondition(
        { ...baseInput, combatV6ResourceAuthority },
        storedCondition,
      ),
    },
  };
}

async function loadCultivatorDungeonPromptBaseFacts(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<CultivatorDungeonPromptBaseFacts | null> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      gender: schema.cultivators.gender,
      age: schema.cultivators.age,
      lifespan: schema.cultivators.lifespan,
      personality: schema.cultivators.personality,
      background: schema.cultivators.background,
      realm: schema.cultivators.realm,
      realmStage: schema.cultivators.realm_stage,
      vitality: schema.cultivators.vitality,
      strength: schema.cultivators.strength,
      spirit: schema.cultivators.spirit,
      endurance: schema.cultivators.endurance,
      speed: schema.cultivators.speed,
      willpower: schema.cultivators.willpower,
      spiritStones: schema.cultivators.spirit_stones,
      condition: schema.cultivators.condition,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;

  const [roots, fates, sect] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(schema.spiritualRoots)
        .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId)),
    () => getCultivatorPreHeavenFates(cultivatorId, q),
    () => loadCultivatorSectState(cultivatorId, q),
  ]);
  return {
    id: row.id,
    name: row.name,
    gender: (row.gender as GenderType) || undefined,
    age: row.age,
    lifespan: row.lifespan,
    personality: row.personality || undefined,
    background: row.background || undefined,
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
    spirit_stones: row.spiritStones,
    condition:
      (row.condition as CultivatorCondition | null | undefined) ?? undefined,
    spiritual_roots: mapSpiritualRoots(roots),
    pre_heaven_fates: fates,
    sect,
  };
}

export async function loadCultivatorDungeonPromptFacts(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<CultivatorDungeonPromptFacts | null> {
  const q = executor ?? getExecutor();
  const [base, gongfa, artifacts] = await runDbTasks(q, [
    () => loadCultivatorDungeonPromptBaseFacts(cultivatorId, q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'gongfa', q),
    () =>
      creationProductRepository.findEquippedByType(cultivatorId, 'artifact', q),
  ]);
  if (!base) return null;
  const loadout = mapLoadoutFromProducts([gongfa, artifacts]);
  return {
    ...base,
    cultivations: loadout.cultivations,
    equipped: loadout.equipped,
    inventory: { artifacts: loadout.artifacts },
  };
}

export async function loadCultivatorTowerRewardFacts(
  cultivator: CultivatorCombatInput,
  executor?: DbExecutor | DbTransaction,
): Promise<CultivatorTowerRewardFacts | null> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({
      gender: schema.cultivators.gender,
      age: schema.cultivators.age,
      lifespan: schema.cultivators.lifespan,
      personality: schema.cultivators.personality,
      background: schema.cultivators.background,
      spiritStones: schema.cultivators.spirit_stones,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivator.id!),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    ...cultivator,
    gender: (row.gender as GenderType) || undefined,
    age: row.age,
    lifespan: row.lifespan,
    personality: row.personality || undefined,
    background: row.background || undefined,
    spirit_stones: row.spiritStones,
  };
}

export async function loadCultivatorInspectionData(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<CultivatorInspectionData | null> {
  const q = executor ?? getExecutor();
  const owner = await findCultivatorOwnerStatusById(cultivatorId, q);
  if (!owner || owner.status !== 'active') return null;
  const [identity, loadout, sect, state] = await runDbTasks(q, [
    () => getPlayerIdentityCultivatorById(owner.userId, cultivatorId, q),
    () => getPlayerLoadoutByCultivatorId(cultivatorId, q),
    () => loadCultivatorSectState(cultivatorId, q),
    async (): Promise<{ condition: unknown } | null> => {
      const rows = await q
        .select({ condition: schema.cultivators.condition })
        .from(schema.cultivators)
        .where(eq(schema.cultivators.id, cultivatorId))
        .limit(1);
      return rows[0] ?? null;
    },
  ]);
  if (!identity || !state) return null;
  const combatV6 = await readCombatV6ConditionAuthority(cultivatorId, q);
  return {
    combatPanel: combatV6.attrs,
    id: identity.id,
    name: identity.name,
    title: identity.title,
    gender: identity.gender,
    background: identity.background,
    realm: identity.realm,
    realm_stage: identity.realm_stage,
    attributes: identity.attributes,
    spiritual_roots: identity.spiritual_roots,
    pre_heaven_fates: identity.pre_heaven_fates,
    cultivations: loadout.cultivations,
    skills: loadout.skills,
    equipped: loadout.equipped,
    condition:
      (state.condition as CultivatorCondition | null | undefined) ?? undefined,
    sect,
    inventory: { artifacts: loadout.artifacts },
  };
}
