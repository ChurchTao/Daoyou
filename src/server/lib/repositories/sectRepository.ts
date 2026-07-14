import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  creationProducts,
  sectAbilityLoadouts,
  sectDailyCommissions,
  sectMemberships,
  sectMeridianLoadouts,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import type {
  CultivatorSectState,
  LingxiaoAbilityId,
  LingxiaoMethodId,
  SectAbilitySlots,
  SectTacticId,
} from '@shared/engine/sect';
import { and, eq, sql } from 'drizzle-orm';

export type SectMembershipRow = typeof sectMemberships.$inferSelect;

export function hydrateSectAbilitySlots(
  rows: Array<{ slot: number; abilityId: LingxiaoAbilityId }>,
): SectAbilitySlots {
  const slots: SectAbilitySlots = [null, null, null, null];
  for (const row of rows) {
    if (row.slot >= 1 && row.slot <= 4) slots[row.slot - 1] = row.abilityId;
  }
  return slots;
}

export async function findMembership(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<SectMembershipRow | null> {
  const [row] = await q.select().from(sectMemberships)
    .where(eq(sectMemberships.cultivatorId, cultivatorId)).limit(1);
  return row ?? null;
}

export async function loadCultivatorSectState(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<CultivatorSectState | undefined> {
  const membership = await findMembership(cultivatorId, q);
  if (!membership) return undefined;
  // A Drizzle transaction uses one checked-out pg client. Starting these reads
  // concurrently on that client triggers pg's "client is already executing a
  // query" deprecation warning and will stop working in pg 9.
  const methods = await q.select().from(sectMethodProgress)
    .where(eq(sectMethodProgress.membershipId, membership.id));
  const meridians = await q.select().from(sectMeridianLoadouts)
    .where(eq(sectMeridianLoadouts.membershipId, membership.id));
  const abilities = await q.select().from(sectAbilityLoadouts)
    .where(eq(sectAbilityLoadouts.membershipId, membership.id));
  return {
    membershipId: membership.id,
    sectId: 'lingxiao',
    status: membership.status as CultivatorSectState['status'],
    experiencedAt: membership.experiencedAt?.toISOString(),
    joinedAt: membership.joinedAt?.toISOString(),
    pathId: membership.pathId ?? undefined,
    contribution: membership.contribution,
    tacticId: membership.tacticId,
    activeMeridianSlot: membership.activeMeridianSlot as 1 | 2 | 3,
    configVersion: membership.configVersion,
    methods: Object.fromEntries(methods.map((row) => [row.methodId, row.level])),
    meridianLoadouts: meridians
      .map((row) => ({ slot: row.slot as 1 | 2 | 3, nodeIds: row.nodeIds, version: row.version }))
      .sort((a, b) => a.slot - b.slot),
    abilityLoadout: hydrateSectAbilitySlots(abilities),
  };
}

export async function recordExperience(cultivatorId: string, tx: DbTransaction): Promise<SectMembershipRow> {
  const [row] = await tx.insert(sectMemberships).values({
    cultivatorId, sectId: 'lingxiao', status: 'prospect', experiencedAt: new Date(),
  }).onConflictDoUpdate({
    target: sectMemberships.cultivatorId,
    set: { experiencedAt: new Date(), updatedAt: new Date() },
  }).returning();
  return row;
}

export async function activateMembership(membershipId: string, tx: DbTransaction): Promise<void> {
  await tx.update(sectMemberships).set({
    status: 'active', joinedAt: new Date(), contribution: 30, tacticId: 'steady',
    activeMeridianSlot: 1, configVersion: 1,
  }).where(and(eq(sectMemberships.id, membershipId), eq(sectMemberships.status, 'prospect')));
  await tx.insert(sectMethodProgress).values([
    { membershipId, methodId: 'lingxiao-canon', level: 5 },
    { membershipId, methodId: 'sword-guidance', level: 5 },
  ]).onConflictDoNothing();
  await tx.insert(sectMeridianLoadouts).values([1, 2, 3].map((slot) => ({ membershipId, slot, nodeIds: [] }))).onConflictDoNothing();
  await tx.insert(sectAbilityLoadouts).values({ membershipId, slot: 1, abilityId: 'guiding-sword' }).onConflictDoNothing();
  await tx.update(creationProducts).set({ isEquipped: false })
    .where(and(eq(creationProducts.cultivatorId, (await tx.select({ cultivatorId: sectMemberships.cultivatorId }).from(sectMemberships).where(eq(sectMemberships.id, membershipId)).limit(1))[0].cultivatorId), eq(creationProducts.productType, 'skill')));
}

export async function setMethodLevel(membershipId: string, methodId: LingxiaoMethodId, level: number, tx: DbTransaction): Promise<void> {
  await tx.insert(sectMethodProgress).values({ membershipId, methodId, level }).onConflictDoUpdate({
    target: [sectMethodProgress.membershipId, sectMethodProgress.methodId], set: { level, updatedAt: new Date() },
  });
}

export async function spendContribution(membershipId: string, amount: number, tx: DbTransaction): Promise<boolean> {
  const rows = await tx.update(sectMemberships).set({ contribution: sql`${sectMemberships.contribution} - ${amount}` })
    .where(and(eq(sectMemberships.id, membershipId), sql`${sectMemberships.contribution} >= ${amount}`)).returning({ id: sectMemberships.id });
  return rows.length === 1;
}

export async function selectSwiftPath(membershipId: string, tx: DbTransaction): Promise<boolean> {
  const rows = await tx.update(sectMemberships).set({ pathId: 'swift-sword' })
    .where(and(eq(sectMemberships.id, membershipId), sql`${sectMemberships.pathId} is null`)).returning({ id: sectMemberships.id });
  return rows.length === 1;
}

export async function replaceMeridianLoadout(membershipId: string, slot: number, nodeIds: string[], tx: DbTransaction): Promise<void> {
  await tx.insert(sectMeridianLoadouts).values({ membershipId, slot, nodeIds }).onConflictDoUpdate({
    target: [sectMeridianLoadouts.membershipId, sectMeridianLoadouts.slot],
    set: { nodeIds, version: sql`${sectMeridianLoadouts.version} + 1`, updatedAt: new Date() },
  });
}

export async function activateMeridianLoadout(membershipId: string, slot: number, tx: DbTransaction): Promise<void> {
  await tx.update(sectMemberships).set({ activeMeridianSlot: slot }).where(eq(sectMemberships.id, membershipId));
}

export async function replaceAbilityLoadout(membershipId: string, abilitySlots: SectAbilitySlots, tx: DbTransaction): Promise<void> {
  await tx.delete(sectAbilityLoadouts).where(eq(sectAbilityLoadouts.membershipId, membershipId));
  const values = abilitySlots.flatMap((abilityId, index) => abilityId
    ? [{ membershipId, slot: index + 1, abilityId }]
    : []);
  if (values.length) await tx.insert(sectAbilityLoadouts).values(values);
}

export async function setTactic(membershipId: string, tacticId: SectTacticId, tx: DbTransaction): Promise<void> {
  await tx.update(sectMemberships).set({ tacticId }).where(eq(sectMemberships.id, membershipId));
}

export async function insertCommissionCompletion(args: { membershipId: string; dateKey: string; completionType: string }, tx: DbTransaction): Promise<boolean> {
  const rows = await tx.insert(sectDailyCommissions).values({ ...args, completedAt: new Date() }).onConflictDoNothing().returning({ id: sectDailyCommissions.id });
  return rows.length === 1;
}

export async function claimCommission(membershipId: string, dateKey: string, reward: number, tx: DbTransaction): Promise<boolean> {
  const rows = await tx.update(sectDailyCommissions).set({ claimedAt: new Date() }).where(and(
    eq(sectDailyCommissions.membershipId, membershipId), eq(sectDailyCommissions.dateKey, dateKey), sql`${sectDailyCommissions.claimedAt} is null`,
  )).returning({ id: sectDailyCommissions.id });
  if (!rows.length) return false;
  await tx.update(sectMemberships).set({ contribution: sql`${sectMemberships.contribution} + ${reward}` }).where(eq(sectMemberships.id, membershipId));
  return true;
}

export async function findCommission(membershipId: string, dateKey: string, q: DbExecutor | DbTransaction) {
  const [row] = await q.select().from(sectDailyCommissions).where(and(eq(sectDailyCommissions.membershipId, membershipId), eq(sectDailyCommissions.dateKey, dateKey))).limit(1);
  return row ?? null;
}
