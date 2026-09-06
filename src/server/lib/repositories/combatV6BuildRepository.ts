import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  combatV6BuildProfiles,
  combatV6EquipmentInstances,
  combatV6EquipmentLoadouts,
  combatV6ManualSlots,
  combatV6ManualStates,
  combatV6MeridianLoadouts,
  combatV6MeridianNodes,
  combatV6MethodProgress,
  cultivators,
  sectMemberships,
} from '@server/lib/drizzle/schema';
import type { CombatV6PersistedBuildV1 } from '@shared/contracts/combatV6';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '@shared/engine/combat-v6/content';
import type { DaoEquipmentLoadoutV1 } from '@shared/engine/combat-v6/equipment';
import type { CultivatorManualStateV1 } from '@shared/engine/combat-v6/manuals';
import { and, eq } from 'drizzle-orm';

export type ActiveCombatV6Membership = {
  membershipId: string;
  cultivatorId: string;
  sectId: string;
};

export async function findActiveCombatV6Membership(
  cultivatorId: string,
  q: DbExecutor,
): Promise<ActiveCombatV6Membership | null> {
  const [row] = await q
    .select({
      membershipId: sectMemberships.id,
      cultivatorId: sectMemberships.cultivatorId,
      sectId: sectMemberships.sectId,
    })
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

export async function findCombatV6Profile(
  membershipId: string,
  q: DbExecutor,
) {
  const [row] = await q
    .select()
    .from(combatV6BuildProfiles)
    .where(eq(combatV6BuildProfiles.membershipId, membershipId))
    .limit(1);
  return row ?? null;
}

export async function listCombatV6MethodLevels(
  profileId: string,
  q: DbExecutor,
): Promise<Record<string, number>> {
  const rows = await q
    .select({ methodId: combatV6MethodProgress.methodId, level: combatV6MethodProgress.level })
    .from(combatV6MethodProgress)
    .where(eq(combatV6MethodProgress.profileId, profileId));
  return Object.fromEntries(rows.map((row) => [row.methodId, row.level]));
}

export async function loadActiveCombatV6Build(
  cultivatorId: string,
  q: DbExecutor,
): Promise<CombatV6PersistedBuildV1 | null> {
  const membership = await findActiveCombatV6Membership(cultivatorId, q);
  if (!membership || !(membership.sectId in COMBAT_V6_SECT_DEFINITIONS_V4)) return null;
  const profile = await findCombatV6Profile(membership.membershipId, q);
  if (!profile || profile.status !== 'active' || !profile.activePathId) return null;
  const sectId = membership.sectId as CombatV6SectId;
  const methods = await listCombatV6MethodLevels(profile.id, q);
  const loadouts = await q
    .select({ id: combatV6MeridianLoadouts.id, pathId: combatV6MeridianLoadouts.pathId, revision: combatV6MeridianLoadouts.revision })
    .from(combatV6MeridianLoadouts)
    .where(eq(combatV6MeridianLoadouts.profileId, profile.id));
  const meridianLoadouts = [] as SectCombatProgressV6['meridianLoadouts'][number][];
  for (const loadout of loadouts) {
    const nodes = await q
      .select({ nodeId: combatV6MeridianNodes.nodeId, layer: combatV6MeridianNodes.layer })
      .from(combatV6MeridianNodes)
      .where(eq(combatV6MeridianNodes.loadoutId, loadout.id));
    meridianLoadouts.push({
      pathId: loadout.pathId,
      revision: loadout.revision,
      nodeIds: nodes.sort((left, right) => left.layer - right.layer || left.nodeId.localeCompare(right.nodeId)).map((node) => node.nodeId),
    });
  }

  const [manualState] = await q
    .select()
    .from(combatV6ManualStates)
    .where(eq(combatV6ManualStates.profileId, profile.id))
    .limit(1);
  if (!manualState) return null;
  const slots = await q
    .select({ slot: combatV6ManualSlots.slot, manualId: combatV6ManualSlots.manualId })
    .from(combatV6ManualSlots)
    .where(eq(combatV6ManualSlots.stateId, manualState.id));
  const manuals: CultivatorManualStateV1 = {
    version: 1,
    revision: manualState.revision,
    build: { slots: slots.map((slot) => ({ slot: slot.slot as 1 | 2 | 3 | 4 | 5 | 6, manualId: slot.manualId })) },
  };

  const equipmentRows = await q
    .select({
      slot: combatV6EquipmentLoadouts.slot,
      instance: combatV6EquipmentInstances.instance,
      ownerId: combatV6EquipmentInstances.cultivatorId,
    })
    .from(combatV6EquipmentLoadouts)
    .innerJoin(
      combatV6EquipmentInstances,
      eq(combatV6EquipmentLoadouts.equipmentInstanceId, combatV6EquipmentInstances.id),
    )
    .where(eq(combatV6EquipmentLoadouts.profileId, profile.id));
  if (equipmentRows.some((row) => row.ownerId !== cultivatorId)) return null;
  const equipment = Object.fromEntries(
    equipmentRows.map((row) => [row.slot, structuredClone(row.instance)]),
  ) as DaoEquipmentLoadoutV1;

  return {
    schemaVersion: 1,
    profileId: profile.id,
    membershipId: membership.membershipId,
    cultivatorId,
    status: 'active',
    revision: profile.revision,
    sect: {
      version: 1,
      sectId,
      methods,
      meridianDepth: profile.meridianDepth as SectCombatProgressV6['meridianDepth'],
      activePathId: profile.activePathId,
      meridianLoadouts: meridianLoadouts as SectCombatProgressV6['meridianLoadouts'],
    },
    manuals,
    equipment,
  };
}

export async function lockActiveMembership(
  cultivatorId: string,
  tx: DbTransaction,
) {
  const [row] = await tx
    .select({
      membershipId: sectMemberships.id,
      cultivatorId: sectMemberships.cultivatorId,
      sectId: sectMemberships.sectId,
    })
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.cultivatorId, cultivatorId),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .for('update')
    .limit(1);
  return row ?? null;
}

export async function characterIdentityRow(cultivatorId: string, q: DbExecutor) {
  const [row] = await q
    .select()
    .from(cultivators)
    .where(and(eq(cultivators.id, cultivatorId), eq(cultivators.status, 'active')))
    .limit(1);
  return row ?? null;
}
