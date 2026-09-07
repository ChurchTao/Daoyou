import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  combatV6BuildProfiles,
  combatV6MeridianLoadouts,
  combatV6MethodProgress,
} from '@server/lib/drizzle/schema';
import {
  findCombatV6Profile,
  listCombatV6MethodLevels,
  loadActiveCombatV6Build,
} from '@server/lib/repositories/combatV6BuildRepository';
import {
  createEmptySectCombatProgressV6,
  createFreshCombatV6MethodLevels,
} from '@shared/engine/combat-v6/build-state';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
} from '@shared/engine/combat-v6/content';
import { transferSectProgress } from '@shared/engine/combat-v6/sect-progression';
import { eq } from 'drizzle-orm';
import { InventoryError } from '../InventoryService';

export async function planV6SectTransfer(
  owner: string,
  membershipId: string,
  sourceId: string,
  targetId: string,
  reverse: boolean,
  q: DbExecutor,
) {
  if (
    !(sourceId in COMBAT_V6_SECT_DEFINITIONS_V4) ||
    !(targetId in COMBAT_V6_SECT_DEFINITIONS_V4)
  )
    throw new InventoryError('目标宗门尚未接入新版传承');
  const source = COMBAT_V6_SECT_DEFINITIONS_V4[sourceId as CombatV6SectId];
  const target = COMBAT_V6_SECT_DEFINITIONS_V4[targetId as CombatV6SectId];
  const profile = await findCombatV6Profile(membershipId, q);
  const active =
    profile?.status === 'active'
      ? await loadActiveCombatV6Build(owner, q)
      : null;
  if (profile?.status === 'active' && !active)
    throw new InventoryError('当前构筑数据不完整');
  const progress = active?.sect ?? {
    ...createEmptySectCombatProgressV6(
      source.id,
      source.paths[0].id,
      profile
        ? await listCombatV6MethodLevels(profile.id, q)
        : createFreshCombatV6MethodLevels(source.id),
    ),
    meridianDepth: (profile?.meridianDepth ?? 0) as
      0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
  };
  return {
    profile,
    source,
    target,
    progress,
    next: transferSectProgress(progress, target.id, reverse),
  };
}

export async function carryV6SectBuild(
  plan: Awaited<ReturnType<typeof planV6SectTransfer>>,
  targetMembershipId: string,
  tx: DbTransaction,
) {
  const previous = await findCombatV6Profile(targetMembershipId, tx);
  // The departing build is authoritative; a historical target profile must not resurrect old loadouts.
  if (previous)
    await tx
      .delete(combatV6BuildProfiles)
      .where(eq(combatV6BuildProfiles.id, previous.id));
  const [profile] = plan.profile
    ? await tx
        .update(combatV6BuildProfiles)
        .set({
          membershipId: targetMembershipId,
          activePathId:
            plan.profile.status === 'active' ? plan.next.activePathId : null,
          revision: plan.profile.revision + 1,
        })
        .where(eq(combatV6BuildProfiles.id, plan.profile.id))
        .returning()
    : await tx
        .insert(combatV6BuildProfiles)
        .values({
          membershipId: targetMembershipId,
          status: 'pending',
          meridianDepth: plan.next.meridianDepth,
        })
        .returning();
  await tx
    .delete(combatV6MethodProgress)
    .where(eq(combatV6MethodProgress.profileId, profile.id));
  await tx.insert(combatV6MethodProgress).values(
    Object.entries(plan.next.methods).map(([methodId, level]) => ({
      profileId: profile.id,
      methodId,
      level,
    })),
  );
  await tx
    .delete(combatV6MeridianLoadouts)
    .where(eq(combatV6MeridianLoadouts.profileId, profile.id));
  if (profile.status === 'active')
    await tx.insert(combatV6MeridianLoadouts).values(
      plan.next.meridianLoadouts.map((loadout) => ({
        profileId: profile.id,
        pathId: loadout.pathId,
        revision: 0,
      })),
    );
  // Manual states and equipment loadouts stay attached to this same profile ID.
}
