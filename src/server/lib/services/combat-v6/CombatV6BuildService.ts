import { db, runDbTasks, type DbExecutor } from '@server/lib/drizzle/db';
import {
  combatV6BuildProfiles,
  combatV6ManualStates,
  combatV6MeridianLoadouts,
  combatV6MethodProgress,
} from '@server/lib/drizzle/schema';
import {
  characterIdentityRow,
  findActiveCombatV6Membership,
  findCombatV6Profile,
  listCombatV6MethodLevels,
  loadActiveCombatV6Build,
  lockActiveMembership,
} from '@server/lib/repositories/combatV6BuildRepository';
import { ResourceEventCommitter } from '@server/lib/services/ResourceEventCommitter';
import type {
  CombatV6BuildInitializeRequest,
  CombatV6BuildViewV1,
} from '@shared/contracts/combatV6';
import { COMBAT_V6_BUILD_ERROR_CODE } from '@shared/contracts/combatV6';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
} from '@shared/engine/combat-v6/content';
import {
  createCombatV6BuildView,
  createFreshCombatV6MethodLevels,
} from '@shared/engine/combat-v6/build-state';
import { projectCultivatorMultiSectV5ToCombatV6 } from '@shared/engine/combat-v6/projection';
import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';

export class CombatV6BuildError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 409 | 422 = 409,
  ) {
    super(message);
    this.name = 'CombatV6BuildError';
  }
}

export async function getCombatV6BuildView(
  cultivatorId: string,
  q: DbExecutor,
): Promise<CombatV6BuildViewV1> {
  const membership = await findActiveCombatV6Membership(cultivatorId, q);
  if (!membership) return createCombatV6BuildView({ status: 'uninitialized' });
  if (!(membership.sectId in COMBAT_V6_SECT_DEFINITIONS_V4)) {
    return createCombatV6BuildView({ status: 'uninitialized', membershipId: membership.membershipId });
  }
  const sectId = membership.sectId as CombatV6SectId;
  const profile = await findCombatV6Profile(membership.membershipId, q);
  const methodLevels = profile
    ? await listCombatV6MethodLevels(profile.id, q)
    : createFreshCombatV6MethodLevels(sectId);
  const base = createCombatV6BuildView({
    status: profile?.status === 'active' ? 'active' : profile ? 'pending' : 'uninitialized',
    revision: profile?.revision ?? 0,
    membershipId: membership.membershipId,
    sectId,
    activePathId: profile?.activePathId ?? undefined,
    methodLevels,
  });
  if (profile?.status !== 'active') return base;
  const build = await loadActiveCombatV6Build(cultivatorId, q);
  if (!build) throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.Invalid, 'combat-v6构筑数据不完整', 422);
  return { ...base, manuals: build.manuals, equipment: build.equipment };
}

export async function initializeCombatV6Build(
  actor: { userId: string; cultivatorId: string },
  input: CombatV6BuildInitializeRequest,
) {
  return db.transaction(async (tx) => {
    const membership = await lockActiveMembership(actor.cultivatorId, tx);
    if (!membership) throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.MembershipRequired, '请先加入宗门', 404);
    if (!(membership.sectId in COMBAT_V6_SECT_DEFINITIONS_V4)) {
      throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.SectUnsupported, '当前宗门尚未接入combat-v6', 422);
    }
    const sectId = membership.sectId as CombatV6SectId;
    const definition = COMBAT_V6_SECT_DEFINITIONS_V4[sectId];
    if (!definition.paths.some((path) => path.id === input.activePathId)) {
      throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.PathInvalid, '所选流派不属于当前宗门', 400);
    }
    let profile = await findCombatV6Profile(membership.membershipId, tx);
    if (profile?.status === 'active' || (profile && profile.revision !== input.expectedRevision)) {
      throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.RevisionConflict, '构筑状态已经变化');
    }
    if (!profile) {
      [profile] = await tx
        .insert(combatV6BuildProfiles)
        .values({ membershipId: membership.membershipId, status: 'pending' })
        .returning();
      if (!profile) throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.Invalid, '无法创建combat-v6构筑', 422);
      const fresh = createFreshCombatV6MethodLevels(sectId);
      await tx.insert(combatV6MethodProgress).values(
        Object.entries(fresh).map(([methodId, level]) => ({ profileId: profile!.id, methodId, level })),
      );
    }
    const levels = await listCombatV6MethodLevels(profile.id, tx);
    if (definition.methods.some((method) => !Number.isInteger(levels[method.id]))) {
      throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.Invalid, '心法迁移数据不完整', 422);
    }
    const [activated] = await tx
      .update(combatV6BuildProfiles)
      .set({ status: 'active', activePathId: input.activePathId, revision: sql`${combatV6BuildProfiles.revision} + 1` })
      .where(and(eq(combatV6BuildProfiles.id, profile.id), eq(combatV6BuildProfiles.status, 'pending'), eq(combatV6BuildProfiles.revision, input.expectedRevision)))
      .returning();
    if (!activated) throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.RevisionConflict, '构筑状态已经变化');
    await tx.insert(combatV6MeridianLoadouts).values(
      definition.paths.map((path) => ({ profileId: profile!.id, pathId: path.id, revision: 0 })),
    );
    await tx.insert(combatV6ManualStates).values({ profileId: profile.id, schemaVersion: 1, revision: 0 });

    const state = await new ResourceEventCommitter().commit(tx, {
      actor,
      source: 'combat-v6-build',
      scopeDefaults: { cultivatorId: actor.cultivatorId },
      changes: [{
        resourceTopic: 'player.combat-v6-build',
        operation: 'invalidate',
        eventType: 'combat_v6.build.initialized',
      }],
    });
    return { result: await getCombatV6BuildView(actor.cultivatorId, tx), state };
  });
}

export async function assembleCombatV6TrainingPlayer(
  cultivatorId: string,
  q: DbExecutor,
): Promise<{ player: CombatV6TrainingPlayerInput; membershipId: string; buildRevision: number }> {
  const membership = await findActiveCombatV6Membership(cultivatorId, q);
  if (!membership) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.MembershipRequired,
      '请先加入宗门',
      404,
    );
  }
  if (!(membership.sectId in COMBAT_V6_SECT_DEFINITIONS_V4)) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.SectUnsupported,
      '当前宗门尚未接入combat-v6',
      422,
    );
  }
  const profile = await findCombatV6Profile(membership.membershipId, q);
  if (!profile) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.NotInitialized,
      '请先初始化combat-v6构筑',
    );
  }
  if (profile.status === 'pending') {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.Pending,
      '请先确认combat-v6流派',
    );
  }
  const [cultivator, build] = await runDbTasks(q, [
    () => characterIdentityRow(cultivatorId, q),
    () => loadActiveCombatV6Build(cultivatorId, q),
  ]);
  if (!cultivator) throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.NotInitialized, '找不到当前角色', 404);
  if (!build) throw new CombatV6BuildError(COMBAT_V6_BUILD_ERROR_CODE.Invalid, 'combat-v6构筑数据不完整', 422);
  const player: CombatV6TrainingPlayerInput = {
    cultivator: {
      id: cultivator.id,
      name: cultivator.name,
      realm: cultivator.realm as RealmType,
      realm_stage: cultivator.realm_stage as RealmStage,
      attributes: {
        vitality: cultivator.vitality,
        strength: cultivator.strength,
        spirit: cultivator.spirit,
        endurance: cultivator.endurance,
        speed: cultivator.speed,
        willpower: cultivator.willpower,
      },
      condition: (cultivator.condition as CultivatorCondition | null) ?? undefined,
    },
    sect: build.sect,
    equipment: build.equipment,
    manuals: build.manuals,
  };
  const projected = projectCultivatorMultiSectV5ToCombatV6({ ...player, side: 0, slot: 0, resourcePolicy: 'full' });
  if (!projected.ok) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.ProjectionFailed,
      projected.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join('; '),
      422,
    );
  }
  return { player: structuredClone(player), membershipId: build.membershipId, buildRevision: build.revision };
}
