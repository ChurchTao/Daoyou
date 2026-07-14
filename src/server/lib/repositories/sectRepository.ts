import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  creationProducts,
  cultivators,
  sectAbilityLoadouts,
  sectDailyCommissions,
  sectMemberships,
  sectMeridianLoadouts,
  sectMethodProgress,
  sectPathProgress,
} from '@server/lib/drizzle/schema';
import {
  productionSectRuntime,
  type CultivatorSectState,
  type SectAbilitySlots,
  type SectDefinition,
  type SectRuntime,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';

export type SectMembershipRow = typeof sectMemberships.$inferSelect;

export interface SectCultivatorProgress {
  realm: RealmType;
  stage: RealmStage;
  stones: number;
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
      playerRace: cultivators.playerRace,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);
  return cultivator ? (cultivator as SectCultivatorProgress) : null;
}

export async function spendSpiritStones(
  cultivatorId: string,
  amount: number,
  tx: DbTransaction,
): Promise<boolean> {
  const rows = await tx
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${amount}` })
    .where(
      and(
        eq(cultivators.id, cultivatorId),
        sql`${cultivators.spirit_stones} >= ${amount}`,
      ),
    )
    .returning({ id: cultivators.id });
  return rows.length === 1;
}

export function hydrateSectAbilitySlots(
  rows: Array<{ slot: number; abilityId: string }>,
): SectAbilitySlots {
  const slots: SectAbilitySlots = [null, null, null, null];
  for (const row of rows)
    if (row.slot >= 1 && row.slot <= 4) slots[row.slot - 1] = row.abilityId;
  return slots;
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
  const methods = await q
    .select()
    .from(sectMethodProgress)
    .where(eq(sectMethodProgress.membershipId, membership.id));
  const pathRows = await q
    .select()
    .from(sectPathProgress)
    .where(eq(sectPathProgress.membershipId, membership.id));
  const meridians = await q
    .select()
    .from(sectMeridianLoadouts)
    .where(eq(sectMeridianLoadouts.membershipId, membership.id));
  const abilities = await q
    .select()
    .from(sectAbilityLoadouts)
    .where(eq(sectAbilityLoadouts.membershipId, membership.id));
  const state: CultivatorSectState = {
    membershipId: membership.id,
    sectId: membership.sectId,
    status: membership.status as CultivatorSectState['status'],
    experiencedAt: membership.experiencedAt?.toISOString(),
    joinedAt: membership.joinedAt?.toISOString(),
    activePathId: membership.activePathId ?? undefined,
    contribution: membership.contribution,
    configVersion: membership.configVersion,
    methods: Object.fromEntries(
      methods.map((row) => [row.methodId, row.level]),
    ),
    paths: pathRows.map((path) => ({
      pathId: path.pathId,
      level: path.level,
      tacticId: path.tacticId,
      activeMeridianSlot: path.activeMeridianSlot as 1 | 2 | 3,
      meridianLoadouts: meridians
        .filter((loadout) => loadout.pathId === path.pathId)
        .map((loadout) => ({
          slot: loadout.slot as 1 | 2 | 3,
          nodeIds: loadout.nodeIds,
          version: loadout.version,
        }))
        .sort((a, b) => a.slot - b.slot),
    })),
    abilityLoadout: hydrateSectAbilitySlots(abilities),
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

export async function recordExperience(
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
      experiencedAt: new Date(),
      configVersion,
    })
    .onConflictDoUpdate({
      target: [sectMemberships.cultivatorId, sectMemberships.sectId],
      set: { experiencedAt: new Date(), updatedAt: new Date(), configVersion },
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
      activePathId: null,
      configVersion: definition.configVersion,
    })
    .where(
      and(
        eq(sectMemberships.id, membershipId),
        eq(sectMemberships.status, 'prospect'),
      ),
    );
  const initialMethods = Object.entries(
    definition.onboarding.initialMethods,
  ).map(([methodId, level]) => ({ membershipId, methodId, level }));
  if (initialMethods.length)
    await tx
      .insert(sectMethodProgress)
      .values(initialMethods)
      .onConflictDoNothing();
  const initialAbilities = definition.onboarding.initialAbilityLoadout.flatMap(
    (abilityId, index) =>
      abilityId ? [{ membershipId, slot: index + 1, abilityId }] : [],
  );
  if (initialAbilities.length)
    await tx
      .insert(sectAbilityLoadouts)
      .values(initialAbilities)
      .onConflictDoNothing();
  const [membership] = await tx
    .select({ cultivatorId: sectMemberships.cultivatorId })
    .from(sectMemberships)
    .where(eq(sectMemberships.id, membershipId))
    .limit(1);
  if (membership) {
    await tx
      .update(creationProducts)
      .set({ isEquipped: false })
      .where(
        and(
          eq(creationProducts.cultivatorId, membership.cultivatorId),
          eq(creationProducts.productType, 'skill'),
        ),
      );
  }
}

export async function setMethodLevel(
  membershipId: string,
  methodId: string,
  level: number,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .insert(sectMethodProgress)
    .values({ membershipId, methodId, level })
    .onConflictDoUpdate({
      target: [sectMethodProgress.membershipId, sectMethodProgress.methodId],
      set: { level, updatedAt: new Date() },
    });
}

export async function enrollPath(
  membershipId: string,
  pathId: string,
  tacticId: string,
  tx: DbTransaction,
): Promise<boolean> {
  const rows = await tx
    .insert(sectPathProgress)
    .values({ membershipId, pathId, level: 0, tacticId, activeMeridianSlot: 1 })
    .onConflictDoNothing()
    .returning({ id: sectPathProgress.id });
  if (!rows.length) return false;
  await tx
    .insert(sectMeridianLoadouts)
    .values(
      [1, 2, 3].map((slot) => ({ membershipId, pathId, slot, nodeIds: [] })),
    )
    .onConflictDoNothing();
  return true;
}

export async function setPathLevel(
  membershipId: string,
  pathId: string,
  level: number,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .update(sectPathProgress)
    .set({ level, updatedAt: new Date() })
    .where(
      and(
        eq(sectPathProgress.membershipId, membershipId),
        eq(sectPathProgress.pathId, pathId),
      ),
    );
}

export async function activatePath(
  membershipId: string,
  pathId: string,
  tx: DbTransaction,
): Promise<boolean> {
  const learned = await tx
    .select({ id: sectPathProgress.id })
    .from(sectPathProgress)
    .where(
      and(
        eq(sectPathProgress.membershipId, membershipId),
        eq(sectPathProgress.pathId, pathId),
      ),
    )
    .limit(1);
  if (!learned.length) return false;
  await tx
    .update(sectMemberships)
    .set({ activePathId: pathId, updatedAt: new Date() })
    .where(eq(sectMemberships.id, membershipId));
  return true;
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

export async function replaceMeridianLoadout(
  membershipId: string,
  pathId: string,
  slot: number,
  nodeIds: string[],
  tx: DbTransaction,
): Promise<void> {
  await tx
    .insert(sectMeridianLoadouts)
    .values({ membershipId, pathId, slot, nodeIds })
    .onConflictDoUpdate({
      target: [
        sectMeridianLoadouts.membershipId,
        sectMeridianLoadouts.pathId,
        sectMeridianLoadouts.slot,
      ],
      set: {
        nodeIds,
        version: sql`${sectMeridianLoadouts.version} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function activateMeridianLoadout(
  membershipId: string,
  pathId: string,
  slot: number,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .update(sectPathProgress)
    .set({ activeMeridianSlot: slot, updatedAt: new Date() })
    .where(
      and(
        eq(sectPathProgress.membershipId, membershipId),
        eq(sectPathProgress.pathId, pathId),
      ),
    );
}

export async function replaceAbilityLoadout(
  membershipId: string,
  abilitySlots: SectAbilitySlots,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .delete(sectAbilityLoadouts)
    .where(eq(sectAbilityLoadouts.membershipId, membershipId));
  const values = abilitySlots.flatMap((abilityId, index) =>
    abilityId ? [{ membershipId, slot: index + 1, abilityId }] : [],
  );
  if (values.length) await tx.insert(sectAbilityLoadouts).values(values);
}

export async function setPathTactic(
  membershipId: string,
  pathId: string,
  tacticId: string,
  tx: DbTransaction,
): Promise<void> {
  await tx
    .update(sectPathProgress)
    .set({ tacticId, updatedAt: new Date() })
    .where(
      and(
        eq(sectPathProgress.membershipId, membershipId),
        eq(sectPathProgress.pathId, pathId),
      ),
    );
}

export async function insertCommissionCompletion(
  args: { membershipId: string; dateKey: string; completionType: string },
  tx: DbTransaction,
): Promise<boolean> {
  const rows = await tx
    .insert(sectDailyCommissions)
    .values({ ...args, completedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: sectDailyCommissions.id });
  return rows.length === 1;
}

export async function claimCommission(
  membershipId: string,
  dateKey: string,
  reward: number,
  tx: DbTransaction,
): Promise<boolean> {
  const rows = await tx
    .update(sectDailyCommissions)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(sectDailyCommissions.membershipId, membershipId),
        eq(sectDailyCommissions.dateKey, dateKey),
        sql`${sectDailyCommissions.claimedAt} is null`,
      ),
    )
    .returning({ id: sectDailyCommissions.id });
  if (!rows.length) return false;
  await tx
    .update(sectMemberships)
    .set({ contribution: sql`${sectMemberships.contribution} + ${reward}` })
    .where(eq(sectMemberships.id, membershipId));
  return true;
}

export async function findCommission(
  membershipId: string,
  dateKey: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectDailyCommissions)
    .where(
      and(
        eq(sectDailyCommissions.membershipId, membershipId),
        eq(sectDailyCommissions.dateKey, dateKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function createSectRepository(
  runtime: SectRuntime = productionSectRuntime,
) {
  return {
    loadCultivatorProgress: loadSectCultivatorProgress,
    spendSpiritStones,
    findMembership,
    findMembershipForSect,
    listMemberships,
    loadCultivatorSectState: (
      cultivatorId: string,
      q: DbExecutor | DbTransaction,
    ) => loadCultivatorSectState(cultivatorId, q, runtime),
    loadCultivatorSectStateForSect: (
      cultivatorId: string,
      sectId: string,
      q: DbExecutor | DbTransaction,
    ) => loadCultivatorSectStateForSect(cultivatorId, sectId, q, runtime),
    recordExperience,
    activateMembership,
    setMethodLevel,
    enrollPath,
    setPathLevel,
    activatePath,
    spendContribution,
    replaceMeridianLoadout,
    activateMeridianLoadout,
    replaceAbilityLoadout,
    setPathTactic,
    insertCommissionCompletion,
    claimCommission,
    findCommission,
  };
}

export type SectRepositoryPort = ReturnType<typeof createSectRepository>;
export const postgresSectRepository = createSectRepository();
