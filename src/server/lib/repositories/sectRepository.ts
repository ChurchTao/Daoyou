import { createFreshCombatV6MethodLevels } from '@shared/engine/combat-v6/build-state';
import { COMBAT_V6_SECT_DEFINITIONS_V4, type CombatV6SectId } from '@shared/engine/combat-v6/content';
import {
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  cultivators,
  sectMemberships,
  sectCombatStates,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import type { ResourceDataMap } from '@shared/contracts/resources';
import {
  type CultivatorSectState,
  type SectDefinition,
  type SectRuntime,
  type SectTrainingCost,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { CultivationProgress } from '@shared/types/cultivator';
import { and, eq, sql } from 'drizzle-orm';

export type SectMembershipRow = typeof sectMemberships.$inferSelect;

export interface SectCultivatorProgress {
  realm: RealmType;
  stage: RealmStage;
  stones: number;
  cultivationExp: number;
  comprehensionInsight: number;
  resourceProgress: ResourceDataMap['player.progress'];
  playerRace: 'human';
}

export async function loadSectCultivatorProgress(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<SectCultivatorProgress | null> {
  const [cultivator] = await q
    .select({
      realm: cultivators.realm,
      stage: cultivators.realm_stage,
      stones: cultivators.spirit_stones,
      cultivationProgress: cultivators.cultivation_progress,
      playerRace: cultivators.playerRace,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);
  if (!cultivator) return null;
  const progress =
    (cultivator.cultivationProgress as Partial<CultivationProgress> | null) ??
    {};
  return {
    realm: cultivator.realm as RealmType,
    stage: cultivator.stage as RealmStage,
    stones: cultivator.stones,
    cultivationExp: progress.cultivation_exp ?? 0,
    comprehensionInsight: progress.comprehension_insight ?? 0,
    resourceProgress: getOrInitCultivationProgress(
      progress as CultivationProgress,
      cultivator.realm as RealmType,
      cultivator.stage as RealmStage,
    ),
    playerRace: cultivator.playerRace as 'human',
  };
}

export async function spendTrainingResources(
  cultivatorId: string,
  cost: SectTrainingCost,
  tx: DbTransaction,
): Promise<boolean> {
  const cultivationProgress = sql`COALESCE(${cultivators.cultivation_progress}, '{}'::jsonb)`;
  const rows = await tx
    .update(cultivators)
    .set({
      spirit_stones: sql`${cultivators.spirit_stones} - ${cost.spiritStones}`,
      cultivation_progress: sql`jsonb_set(
        jsonb_set(
          ${cultivationProgress},
          '{cultivation_exp}',
          to_jsonb(COALESCE((${cultivators.cultivation_progress}->>'cultivation_exp')::int, 0) - ${cost.cultivationExp})
        ),
        '{comprehension_insight}',
        to_jsonb(COALESCE((${cultivators.cultivation_progress}->>'comprehension_insight')::int, 0) - ${cost.comprehensionInsight})
      )`,
    })
    .where(
      and(
        eq(cultivators.id, cultivatorId),
        sql`${cultivators.spirit_stones} >= ${cost.spiritStones}`,
        sql`COALESCE((${cultivators.cultivation_progress}->>'cultivation_exp')::int, 0) >= ${cost.cultivationExp}`,
        sql`COALESCE((${cultivators.cultivation_progress}->>'comprehension_insight')::int, 0) >= ${cost.comprehensionInsight}`,
      ),
    )
    .returning({ id: cultivators.id });
  return rows.length === 1;
}

export async function findMembership(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<SectMembershipRow | null> {
  const [row] = await q
    .select()
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.cultivatorId, cultivatorId),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findMembershipForSect(
  cultivatorId: string,
  sectId: string,
  q: DbExecutor | DbTransaction,
): Promise<SectMembershipRow | null> {
  const [row] = await q
    .select()
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.cultivatorId, cultivatorId),
        eq(sectMemberships.sectId, sectId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listMemberships(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  return q
    .select()
    .from(sectMemberships)
    .where(eq(sectMemberships.cultivatorId, cultivatorId));
}

async function hydrateMembership(
  membership: SectMembershipRow,
  q: DbExecutor | DbTransaction,
  runtime: SectRuntime,
): Promise<CultivatorSectState> {
  const state: CultivatorSectState = {
    membershipId: membership.id,
    sectId: membership.sectId,
    status: membership.status as CultivatorSectState['status'],
    joinedAt: membership.joinedAt?.toISOString(),
    contribution: membership.contribution,
    lifetimeContribution: membership.lifetimeContribution,
    discipleRank:
      membership.discipleRank as CultivatorSectState['discipleRank'],
    office: membership.office as CultivatorSectState['office'],
    promotedAt: membership.promotedAt?.toISOString(),
    configVersion: membership.configVersion,
  };
  try {
    runtime.validateState(state);
  } catch (error) {
    console.error(
      `[sect-repository] persisted sect state is invalid: membership=${membership.id} sect=${membership.sectId} version=${membership.configVersion}`,
      error,
    );
    throw error;
  }
  return state;
}

export async function loadCultivatorSectState(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
  runtime: SectRuntime = productionSectRuntime,
): Promise<CultivatorSectState | undefined> {
  const membership = await findMembership(cultivatorId, q);
  return membership ? hydrateMembership(membership, q, runtime) : undefined;
}

export async function loadCultivatorSectStateForSect(
  cultivatorId: string,
  sectId: string,
  q: DbExecutor | DbTransaction,
  runtime: SectRuntime = productionSectRuntime,
): Promise<CultivatorSectState | undefined> {
  const membership = await findMembershipForSect(cultivatorId, sectId, q);
  return membership ? hydrateMembership(membership, q, runtime) : undefined;
}

export async function ensureMembershipCandidate(
  cultivatorId: string,
  sectId: string,
  configVersion: number,
  tx: DbTransaction,
): Promise<SectMembershipRow> {
  const [row] = await tx
    .insert(sectMemberships)
    .values({
      cultivatorId,
      sectId,
      status: 'prospect',
      configVersion,
    })
    .onConflictDoUpdate({
      target: [sectMemberships.cultivatorId, sectMemberships.sectId],
      set: { updatedAt: new Date(), configVersion },
    })
    .returning();
  return row;
}

export async function activateMembership(
  membershipId: string,
  definition: SectDefinition,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .update(sectMemberships)
    .set({
      status: 'active',
      joinedAt: new Date(),
      contribution: definition.onboarding.initialContribution,
      // Rejoining a sect resets spendable balance, but never erases earned history.
      lifetimeContribution: sql`GREATEST(${sectMemberships.lifetimeContribution}, ${definition.onboarding.initialContribution})`,
      configVersion: definition.configVersion,
    })
    .where(
      and(
        eq(sectMemberships.id, membershipId),
        eq(sectMemberships.status, 'prospect'),
      ),
    );
  const sectId = definition.id;
  if (!(sectId in COMBAT_V6_SECT_DEFINITIONS_V4)) throw new Error('宗门战斗定义不存在');
  await tx.insert(sectCombatStates).values({membershipId}).onConflictDoNothing();
  await tx.insert(sectMethodProgress).values(
    Object.entries(createFreshCombatV6MethodLevels(sectId as CombatV6SectId)).map(([methodId, level]) => ({membershipId, methodId, level})),
  ).onConflictDoNothing();

}

export async function spendContribution(
  membershipId: string,
  amount: number,
  tx: DbTransaction,
): Promise<boolean> {
  const rows = await tx
    .update(sectMemberships)
    .set({ contribution: sql`${sectMemberships.contribution} - ${amount}` })
    .where(
      and(
        eq(sectMemberships.id, membershipId),
        sql`${sectMemberships.contribution} >= ${amount}`,
      ),
    )
    .returning({ id: sectMemberships.id });
  return rows.length === 1;
}
