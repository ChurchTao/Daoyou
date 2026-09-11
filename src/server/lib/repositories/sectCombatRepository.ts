import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  sectCombatStates,
  sectMemberships,
  sectMeridianLoadouts,
  sectMeridianNodes,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '@shared/engine/combat-v6/content';
import { and, eq } from 'drizzle-orm';

export type ActiveSectMembership = {
  membershipId: string;
  cultivatorId: string;
  sectId: string;
};

export async function findActiveSectMembership(
  cultivatorId: string,
  q: DbExecutor,
): Promise<ActiveSectMembership | null> {
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

export async function findSectCombatState(membershipId: string, q: DbExecutor) {
  const [row] = await q
    .select()
    .from(sectCombatStates)
    .where(eq(sectCombatStates.membershipId, membershipId));
  return row ?? null;
}

export async function readSectMethodLevels(
  membershipId: string,
  q: DbExecutor,
): Promise<Record<string, number>> {
  const rows = await q
    .select({
      methodId: sectMethodProgress.methodId,
      level: sectMethodProgress.level,
    })
    .from(sectMethodProgress)
    .where(eq(sectMethodProgress.membershipId, membershipId));
  return Object.fromEntries(rows.map((row) => [row.methodId, row.level]));
}

export async function readSectCombatProgress(
  membershipId: string,
  q: DbExecutor,
): Promise<{
  membershipId: string;
  revision: number;
  sect: SectCombatProgressV6;
} | null> {
  const [membership] = await q
    .select({
      membershipId: sectMemberships.id,
      sectId: sectMemberships.sectId,
    })
    .from(sectMemberships)
    .where(eq(sectMemberships.id, membershipId));
  if (!membership || !(membership.sectId in COMBAT_V6_SECT_DEFINITIONS_V4))
    return null;
  const state = await findSectCombatState(membership.membershipId, q);
  if (!state?.activePathId) return null;
  const sectId = membership.sectId as CombatV6SectId;
  const methods = await readSectMethodLevels(membership.membershipId, q);
  const loadouts = await q
    .select({
      id: sectMeridianLoadouts.id,
      pathId: sectMeridianLoadouts.pathId,
      revision: sectMeridianLoadouts.revision,
    })
    .from(sectMeridianLoadouts)
    .where(eq(sectMeridianLoadouts.membershipId, membership.membershipId));
  const meridianLoadouts =
    [] as SectCombatProgressV6['meridianLoadouts'][number][];
  for (const loadout of loadouts) {
    const nodes = await q
      .select({
        nodeId: sectMeridianNodes.nodeId,
        layer: sectMeridianNodes.layer,
      })
      .from(sectMeridianNodes)
      .where(eq(sectMeridianNodes.loadoutId, loadout.id));
    meridianLoadouts.push({
      pathId: loadout.pathId,
      revision: loadout.revision,
      nodeIds: nodes
        .sort(
          (left, right) =>
            left.layer - right.layer || left.nodeId.localeCompare(right.nodeId),
        )
        .map((node) => node.nodeId),
    });
  }

  return {
    membershipId: membership.membershipId,
    revision: state.revision,
    sect: {
      version: 1,
      sectId,
      methods,
      meridianDepth:
        state.meridianDepth as SectCombatProgressV6['meridianDepth'],
      activePathId: state.activePathId,
      meridianLoadouts:
        meridianLoadouts as SectCombatProgressV6['meridianLoadouts'],
    },
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

export async function characterIdentityRow(
  cultivatorId: string,
  q: DbExecutor,
) {
  const [row] = await q
    .select()
    .from(cultivators)
    .where(
      and(eq(cultivators.id, cultivatorId), eq(cultivators.status, 'active')),
    )
    .limit(1);
  return row ?? null;
}

export async function readActiveSectCombatProgress(
  cultivatorId: string,
  q: DbExecutor,
) {
  const membership = await findActiveSectMembership(cultivatorId, q);
  return membership ? readSectCombatProgress(membership.membershipId, q) : null;
}
