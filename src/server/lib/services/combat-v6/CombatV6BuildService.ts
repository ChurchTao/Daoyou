import { readCharacterEquipment, readCharacterManuals } from '@server/lib/repositories/characterLoadoutRepository';
import { db, runDbTasks, type DbExecutor } from '@server/lib/drizzle/db';
import {
  sectCombatStates,
  sectMeridianLoadouts,
  sectMethodProgress,
} from '@server/lib/drizzle/schema';
import { readBeastRoster } from '@server/lib/repositories/combatV6BeastRepository';
import {
  characterIdentityRow,
  findActiveSectMembership,
  findSectCombatState,
  readSectMethodLevels,
  readActiveSectCombatProgress,
  lockActiveMembership,
} from '@server/lib/repositories/sectCombatRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { ResourceEventCommitter } from '@server/lib/services/ResourceEventCommitter';
import type {
  SectPathSelectionRequest,
  SectCombatView,
} from '@shared/contracts/combatV6';
import { COMBAT_V6_BUILD_ERROR_CODE } from '@shared/contracts/combatV6';
import {
  createSectCombatView,
  createFreshCombatV6MethodLevels,
} from '@shared/engine/combat-v6/build-state';
import {
  COMBAT_V6_SECT_DEFINITIONS,
  type CombatV6SectId,
} from '@shared/engine/combat-v6/content';
import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import { projectCharacterToCombatV6 } from '@shared/engine/combat-v6/projection';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { assertCombatV6MutationAllowed } from './CombatV6MutationGuard';

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

export async function getSectCombatView(
  cultivatorId: string,
  q: DbExecutor,
): Promise<SectCombatView> {
  const membership = await findActiveSectMembership(cultivatorId, q);
  if (!membership) return createSectCombatView({ status: 'uninitialized' });
  if (!(membership.sectId in COMBAT_V6_SECT_DEFINITIONS)) {
    return createSectCombatView({
      status: 'uninitialized',
      membershipId: membership.membershipId,
    });
  }
  const sectId = membership.sectId as CombatV6SectId;
  const sectState = await findSectCombatState(membership.membershipId, q);
  const methodLevels = sectState
    ? await readSectMethodLevels(membership.membershipId, q)
    : createFreshCombatV6MethodLevels(sectId);
  const base = createSectCombatView({
    status:
      sectState?.activePathId
        ? 'active'
        : sectState
          ? 'pending'
          : 'uninitialized',
    revision: sectState?.revision ?? 0,
    membershipId: membership.membershipId,
    sectId,
    activePathId: sectState?.activePathId ?? undefined,
    methodLevels,
  });
  if (!sectState?.activePathId)
    return { ...base, meridianDepth: sectState?.meridianDepth ?? 0 };
  const build = await readActiveSectCombatProgress(cultivatorId, q);
  if (!build)
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.Invalid,
      'combat-v6构筑数据不完整',
      422,
    );
  return {
    ...base,
    meridianDepth: build.sect.meridianDepth,
  };
}

export async function selectInitialSectPath(
  actor: { userId: string; cultivatorId: string },
  input: SectPathSelectionRequest,
) {
  return db.transaction(async (tx) => {
    await lockCultivatorForStateMutation(tx, actor.cultivatorId);
    await assertCombatV6MutationAllowed(
      actor.cultivatorId,
      'sect_build_initialize',
    );
    const membership = await lockActiveMembership(actor.cultivatorId, tx);
    if (!membership)
      throw new CombatV6BuildError(
        COMBAT_V6_BUILD_ERROR_CODE.MembershipRequired,
        '请先加入宗门',
        404,
      );
    if (!(membership.sectId in COMBAT_V6_SECT_DEFINITIONS)) {
      throw new CombatV6BuildError(
        COMBAT_V6_BUILD_ERROR_CODE.SectUnsupported,
        '当前宗门尚未接入combat-v6',
        422,
      );
    }
    const sectId = membership.sectId as CombatV6SectId;
    const definition = COMBAT_V6_SECT_DEFINITIONS[sectId];
    if (!definition.paths.some((path) => path.id === input.activePathId)) {
      throw new CombatV6BuildError(
        COMBAT_V6_BUILD_ERROR_CODE.PathInvalid,
        '所选流派不属于当前宗门',
        400,
      );
    }
    let sectState = await findSectCombatState(membership.membershipId, tx);
    if (
      sectState?.activePathId ||
      (sectState && sectState.revision !== input.expectedRevision)
    ) {
      throw new CombatV6BuildError(
        COMBAT_V6_BUILD_ERROR_CODE.RevisionConflict,
        '构筑状态已经变化',
      );
    }
    if (!sectState) {
      [sectState] = await tx
        .insert(sectCombatStates)
        .values({ membershipId: membership.membershipId })
        .returning();
      if (!sectState)
        throw new CombatV6BuildError(
          COMBAT_V6_BUILD_ERROR_CODE.Invalid,
          '无法创建combat-v6构筑',
          422,
        );
      const fresh = createFreshCombatV6MethodLevels(sectId);
      await tx.insert(sectMethodProgress).values(
        Object.entries(fresh).map(([methodId, level]) => ({
          membershipId: membership.membershipId,
          methodId,
          level,
        })),
      );
    }
    const levels = await readSectMethodLevels(membership.membershipId, tx);
    if (
      definition.methods.some((method) => !Number.isInteger(levels[method.id]))
    ) {
      throw new CombatV6BuildError(
        COMBAT_V6_BUILD_ERROR_CODE.Invalid,
        '宗门心法数据不完整',
        422,
      );
    }
    const [activated] = await tx
      .update(sectCombatStates)
      .set({
        activePathId: input.activePathId,
        revision: sql`${sectCombatStates.revision} + 1`,
      })
      .where(
        and(
          eq(sectCombatStates.membershipId, membership.membershipId),
          isNull(sectCombatStates.activePathId),
          eq(sectCombatStates.revision, input.expectedRevision),
        ),
      )
      .returning();
    if (!activated)
      throw new CombatV6BuildError(
        COMBAT_V6_BUILD_ERROR_CODE.RevisionConflict,
        '构筑状态已经变化',
      );
    await tx.insert(sectMeridianLoadouts).values(
      definition.paths.map((path) => ({
        membershipId: membership.membershipId,
        pathId: path.id,
        revision: 0,
      })),
    );
    const state = await new ResourceEventCommitter().commit(tx, {
      actor,
      source: 'sect-combat',
      scopeDefaults: { cultivatorId: actor.cultivatorId },
      changes: [
        {
          resourceTopic: 'player.sect-combat',
          operation: 'invalidate',
          eventType: 'combat_v6.build.initialized',
        },
      ],
    });
    return {
      result: await getSectCombatView(actor.cultivatorId, tx),
      state,
    };
  });
}

export async function assembleCombatV6TrainingPlayer(
  cultivatorId: string,
  q: DbExecutor,
): Promise<{
  player: CombatV6TrainingPlayerInput;
  membershipId: string;
}> {
  const membership = await findActiveSectMembership(cultivatorId, q);
  if (!membership) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.MembershipRequired,
      '请先加入宗门',
      404,
    );
  }
  if (!(membership.sectId in COMBAT_V6_SECT_DEFINITIONS)) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.SectUnsupported,
      '当前宗门尚未接入combat-v6',
      422,
    );
  }
  const sectState = await findSectCombatState(membership.membershipId, q);
  if (!sectState) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.NotInitialized,
      '请先前往宗门或练功房选择修行流派',
    );
  }
  if (!sectState.activePathId) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.Pending,
      '请先前往宗门或练功房选择修行流派',
    );
  }
  const [cultivator, build] = await runDbTasks(q, [
    () => characterIdentityRow(cultivatorId, q),
    () => readActiveSectCombatProgress(cultivatorId, q),
  ]);
  if (!cultivator)
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.NotInitialized,
      '找不到当前角色',
      404,
    );
  if (!build)
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.Invalid,
      'combat-v6构筑数据不完整',
      422,
    );
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
      condition:
        (cultivator.condition as CultivatorCondition | null) ?? undefined,
    },
    sect: build.sect,
    equipment: await readCharacterEquipment(cultivatorId, q),
    manuals: await readCharacterManuals(cultivatorId, q),
    beasts: await readBeastRoster(cultivatorId, q),
  };
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) {
    throw new CombatV6BuildError(
      COMBAT_V6_BUILD_ERROR_CODE.ProjectionFailed,
      projected.diagnostics
        .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
        .join('; '),
      422,
    );
  }
  return {
    player: structuredClone(player),
    membershipId: build.membershipId,
  };
}
