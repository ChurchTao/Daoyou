import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  sectCombatStates,
  sectMeridianLoadouts,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import {
  findSectCombatState,
  readSectCombatProgress,
  readSectMethodLevels,
} from '@server/lib/repositories/sectCombatRepository';
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
  const sectState = await findSectCombatState(membershipId, q);
  const active = sectState?.activePathId
    ? await readSectCombatProgress(membershipId, q)
    : null;
  if (sectState?.activePathId && !active)
    throw new InventoryError('当前构筑数据不完整');
  const progress = active?.sect ?? {
    ...createEmptySectCombatProgressV6(
      source.id,
      source.paths[0].id,
      sectState
        ? await readSectMethodLevels(membershipId, q)
        : createFreshCombatV6MethodLevels(source.id),
    ),
    meridianDepth: (sectState?.meridianDepth ?? 0) as
      0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
  };
  return {
    sectState,
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
  // Only sect progress moves. Character manuals and equipment are independent.
  await tx
    .delete(sectMeridianLoadouts)
    .where(eq(sectMeridianLoadouts.membershipId, targetMembershipId));
  await tx
    .delete(sectMethodProgress)
    .where(eq(sectMethodProgress.membershipId, targetMembershipId));
  await tx
    .insert(sectCombatStates)
    .values({
      membershipId: targetMembershipId,
      activePathId: plan.sectState?.activePathId
        ? plan.next.activePathId
        : null,
      meridianDepth: plan.next.meridianDepth,
      revision: (plan.sectState?.revision ?? 0) + 1,
    })
    .onConflictDoUpdate({
      target: sectCombatStates.membershipId,
      set: {
        activePathId: plan.sectState?.activePathId
          ? plan.next.activePathId
          : null,
        meridianDepth: plan.next.meridianDepth,
        revision: (plan.sectState?.revision ?? 0) + 1,
      },
    });
  await tx
    .insert(sectMethodProgress)
    .values(
      Object.entries(plan.next.methods).map(([methodId, level]) => ({
        membershipId: targetMembershipId,
        methodId,
        level,
      })),
    );
  if (plan.sectState?.activePathId)
    await tx
      .insert(sectMeridianLoadouts)
      .values(
        plan.next.meridianLoadouts.map((loadout) => ({
          membershipId: targetMembershipId,
          pathId: loadout.pathId,
          revision: 0,
        })),
      );
  if (plan.sectState && plan.sectState.membershipId !== targetMembershipId) {
    await tx
      .delete(sectMeridianLoadouts)
      .where(
        eq(sectMeridianLoadouts.membershipId, plan.sectState.membershipId),
      );
    await tx
      .delete(sectMethodProgress)
      .where(eq(sectMethodProgress.membershipId, plan.sectState.membershipId));
    await tx
      .delete(sectCombatStates)
      .where(eq(sectCombatStates.membershipId, plan.sectState.membershipId));
  }
}
