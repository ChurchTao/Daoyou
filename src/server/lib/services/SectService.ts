import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  postgresSectRepository,
  type SectRepositoryPort,
} from '@server/lib/repositories/sectRepository';
import {
  assertMethodTrainingTarget,
  createAbilitySlots,
  fillFirstEmptyAbilitySlots,
  isAbilityUnlocked,
  listUnlockedAbilityIds,
  validateMeridianNodeIds,
  type CultivatorSectState,
  type SectAbilitySlots,
  type SectAdmissionContext,
  type SectRuntime,
  type SectTrainingCost,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import type { Cultivator } from '@shared/types/cultivator';
import { getRealmStageRank } from '@shared/config/realmProgression';
import type { SectPathDefinition } from '@shared/engine/sect';
import { getEffectiveSectMethodLevelCap } from '@shared/engine/sect';
import { ensureSectFacilities } from '@server/lib/repositories/sectOrganizationRepository';
import { getSectFacilityBonuses } from './SectFacilityService';
export { SectError, type SectErrorCode } from './SectError';
import { SectError } from './SectError';

async function requireActive(
  repository: SectRepositoryPort,
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<CultivatorSectState> {
  const sect = await repository.loadCultivatorSectState(cultivatorId, q);
  if (!sect || sect.status !== 'active')
    throw new SectError('SECT_TRIAL_REQUIRED', '尚未拜入宗门');
  return sect;
}

async function getCultivatorProgress(
  repository: SectRepositoryPort,
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  const cultivator = await repository.loadCultivatorProgress(cultivatorId, q);
  if (!cultivator) throw new SectError('SECT_REALM_GATE', '角色不存在', 400);
  return cultivator;
}

async function payTrainingCost(
  cultivator: Awaited<ReturnType<typeof getCultivatorProgress>>,
  cultivatorId: string,
  cost: SectTrainingCost,
  tx: DbTransaction,
  repository: SectRepositoryPort,
) {
  if (cultivator.cultivationExp < cost.cultivationExp)
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '修为不足');
  if (cultivator.comprehensionInsight < cost.comprehensionInsight)
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '道心感悟不足');
  if (cultivator.stones < cost.spiritStones)
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '灵石不足');
  if (!(await repository.spendTrainingResources(cultivatorId, cost, tx))) {
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '研习所需资源不足');
  }
  return cost;
}

export interface SectServiceDependencies {
  runtime?: SectRuntime;
  repository?: SectRepositoryPort;
}

/**
 * Application Service: orchestrates transactions and domain operations only.
 * Content decisions are delegated to SectRuntime; persistence stays behind the port.
 */
export class SectApplicationService {
  constructor(
    readonly runtime: SectRuntime = productionSectRuntime,
    private readonly repository: SectRepositoryPort = postgresSectRepository,
  ) {}

  private async assertPathRealm(
    cultivatorId: string,
    sect: CultivatorSectState,
    path: SectPathDefinition,
    q: DbExecutor | DbTransaction,
  ): Promise<void> {
    const cultivator = await getCultivatorProgress(this.repository, cultivatorId, q);
    if (
      getRealmStageRank(cultivator.realm, cultivator.stage) <
      getRealmStageRank(path.minRealm, path.minRealmStage)
    ) {
      throw new SectError(
        'SECT_REALM_GATE',
        `${path.name}须达${path.minRealm}${path.minRealmStage}后方可参悟`,
        400,
      );
    }
  }

  private async assertAdmission(
    cultivatorId: string,
    sectId: string,
    q: DbExecutor | DbTransaction,
  ) {
    const module = this.runtime.registry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const progress = await getCultivatorProgress(
      this.repository,
      cultivatorId,
      q,
    );
    const result = module.checkAdmission(progress);
    if (!result.allowed)
      throw new SectError(
        'SECT_REALM_GATE',
        result.reason ?? '不符合宗门准入条件',
      );
    return module;
  }

  listDefinitions() {
    return this.runtime.registry.listDefinitions();
  }

  listAvailableDefinitions(context: SectAdmissionContext) {
    return this.runtime.registry
      .listDefinitions()
      .filter(
        (definition) =>
          this.runtime.registry.require(definition.id).checkAdmission(context)
            .allowed,
      );
  }

  createTrialScenario(sectId: string, cultivator: Cultivator) {
    const module = this.runtime.registry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const admission = module.checkAdmission({
      playerRace: cultivator.playerRace ?? 'human',
      realm: cultivator.realm,
      stage: cultivator.realm_stage,
    });
    if (!admission.allowed)
      throw new SectError(
        'SECT_REALM_GATE',
        admission.reason ?? '不符合宗门准入条件',
      );
    return module.createTrialScenario({ cultivator });
  }

  listMemberships(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return this.repository.listMemberships(cultivatorId, q);
  }

  getState(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return this.repository.loadCultivatorSectState(cultivatorId, q);
  }

  getStateForSect(
    cultivatorId: string,
    sectId: string,
    q: DbExecutor | DbTransaction,
  ) {
    if (!this.runtime.registry.get(sectId))
      throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    return this.repository.loadCultivatorSectStateForSect(
      cultivatorId,
      sectId,
      q,
    );
  }

  async recordExperience(
    cultivatorId: string,
    sectId: string,
    tx: DbTransaction,
  ) {
    const module = await this.assertAdmission(cultivatorId, sectId, tx);
    const active = await this.repository.findMembership(cultivatorId, tx);
    if (active)
      throw new SectError(
        'SECT_ALREADY_JOINED',
        `已经是${this.runtime.registry.require(active.sectId).definition.name}弟子`,
      );
    await this.repository.recordExperience(
      cultivatorId,
      sectId,
      module.definition.configVersion,
      tx,
    );
    return (await this.repository.loadCultivatorSectStateForSect(
      cultivatorId,
      sectId,
      tx,
    ))!;
  }

  async join(cultivatorId: string, sectId: string, tx: DbTransaction) {
    const module = await this.assertAdmission(cultivatorId, sectId, tx);
    const active = await this.repository.findMembership(cultivatorId, tx);
    if (active)
      throw new SectError(
        'SECT_ALREADY_JOINED',
        `已经是${this.runtime.registry.require(active.sectId).definition.name}弟子`,
      );
    const prospect = await this.repository.findMembershipForSect(
      cultivatorId,
      sectId,
      tx,
    );
    if (!prospect?.experiencedAt)
      throw new SectError('SECT_TRIAL_REQUIRED', '须先完成该宗门入门试炼');
    await this.repository.activateMembership(
      prospect.id,
      module.definition,
      tx,
    );
    if (this.repository === postgresSectRepository)
      await ensureSectFacilities(sectId, tx);
    return (await this.repository.loadCultivatorSectState(cultivatorId, tx))!;
  }

  async trainMethod(
    args: { cultivatorId: string; methodId: string; targetLevel: number },
    tx: DbTransaction,
  ) {
    const sect = await requireActive(this.repository, args.cultivatorId, tx);
    const module = this.runtime.registry.require(sect.sectId);
    const definition = module.definition;
    const cultivator = await getCultivatorProgress(
      this.repository,
      args.cultivatorId,
      tx,
    );
    const currentLevel = sect.methods[args.methodId] ?? 0;
    const realmCap = module.progression.methodLevelCap(
      cultivator.realm,
      cultivator.stage,
    );
    const organization =
      this.repository === postgresSectRepository
        ? await getSectFacilityBonuses(args.cultivatorId, tx)
        : { retreatMultiplier: 1, craftDiscount: 0, archiveLevel: 1 };
    try {
      assertMethodTrainingTarget({
        definition,
        methodId: args.methodId,
        currentLevel,
        targetLevel: args.targetLevel,
        levelCap: getEffectiveSectMethodLevelCap({
          realmCap,
          rank: sect.discipleRank ?? 'registered',
          archiveLevel: organization.archiveLevel,
        }),
        methods: sect.methods,
      });
    } catch (error) {
      throw new SectError(
        'SECT_METHOD_CAP',
        error instanceof Error ? error.message : '心法等级受限',
        400,
      );
    }
    const cost = module.progression.methodTrainingCost(
      currentLevel,
      args.targetLevel,
    );
    await payTrainingCost(
      cultivator,
      args.cultivatorId,
      cost,
      tx,
      this.repository,
    );
    await this.repository.setMethodLevel(
      sect.membershipId,
      args.methodId,
      args.targetLevel,
      tx,
    );
    const trained = await requireActive(this.repository, args.cultivatorId, tx);
    const unlocked = listUnlockedAbilityIds(definition, trained).filter(
      (id) =>
        definition.abilities.find((ability) => ability.id === id)
          ?.occupiesActiveSlot,
    );
    const nextLoadout = fillFirstEmptyAbilitySlots(
      trained.abilityLoadout,
      unlocked,
    );
    if (nextLoadout.some((id, index) => id !== trained.abilityLoadout[index])) {
      await this.repository.replaceAbilityLoadout(
        trained.membershipId,
        nextLoadout,
        tx,
      );
    }
    return {
      sect: await requireActive(this.repository, args.cultivatorId, tx),
      methodId: args.methodId,
      targetLevel: args.targetLevel,
      cost,
    };
  }

  async unlockPathLayer(
    args: { cultivatorId: string; pathId: string; layerId: string },
    tx: DbTransaction,
  ) {
    const sect = await requireActive(this.repository, args.cultivatorId, tx);
    const module = this.runtime.registry.require(sect.sectId);
    const path = module.definition.paths.find(
      (entry) => entry.id === args.pathId,
    );
    if (!path) throw new SectError('SECT_PATH_UNKNOWN', '未知流派', 400);
    const pathState = sect.paths.find((entry) => entry.pathId === args.pathId);
    const cultivator = await getCultivatorProgress(
      this.repository,
      args.cultivatorId,
      tx,
    );
    await this.assertPathRealm(args.cultivatorId, sect, path, tx);
    let layer;
    try {
      layer = module.progression.assertPathLayerUnlock({
        path,
        unlockedLayerIds: pathState?.unlockedLayerIds ?? [],
        layerId: args.layerId,
        realm: cultivator.realm,
        stage: cultivator.stage,
        methods: sect.methods,
      });
    } catch (error) {
      throw new SectError(
        'SECT_REALM_GATE',
        error instanceof Error ? error.message : '流派层级受限',
        400,
      );
    }
    await payTrainingCost(
      cultivator,
      args.cultivatorId,
      layer.cost,
      tx,
      this.repository,
    );
    if (pathState) {
      if (
        !(await this.repository.appendUnlockedPathLayer(
          sect.membershipId,
          args.pathId,
          layer.id,
          pathState.unlockedLayerIds.length,
          tx,
        ))
      ) {
        throw new SectError('SECT_REALM_GATE', '流派层级状态已变化，请重试');
      }
    } else {
      if (
        !(await this.repository.createPathWithFirstLayer(
          sect.membershipId,
          args.pathId,
          path.defaultTacticId,
          layer.id,
          tx,
        ))
      ) {
        throw new SectError('SECT_REALM_GATE', '流派已经习得，请重试');
      }
      await this.repository.activatePathIfNone(
        sect.membershipId,
        args.pathId,
        tx,
      );
    }
    return {
      sect: await requireActive(this.repository, args.cultivatorId, tx),
      pathId: args.pathId,
      layerId: layer.id,
      cost: layer.cost,
    };
  }

  async activatePath(cultivatorId: string, pathId: string, tx: DbTransaction) {
    const sect = await requireActive(this.repository, cultivatorId, tx);
    const path = this.runtime.registry.require(sect.sectId).definition.paths.find(
      (entry) => entry.id === pathId,
    );
    if (!path) throw new SectError('SECT_PATH_UNKNOWN', '未知流派', 400);
    await this.assertPathRealm(cultivatorId, sect, path, tx);
    if (!(await this.repository.activatePath(sect.membershipId, pathId, tx))) {
      throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    }
    return requireActive(this.repository, cultivatorId, tx);
  }

  async setMeridianLoadout(
    cultivatorId: string,
    pathId: string,
    slot: number,
    nodeIds: string[],
    tx: DbTransaction,
  ) {
    if (![1, 2, 3].includes(slot))
      throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(this.repository, cultivatorId, tx);
    const definition = this.runtime.registry.require(sect.sectId).definition;
    const path = definition.paths.find((entry) => entry.id === pathId);
    const pathState = sect.paths.find((entry) => entry.pathId === pathId);
    if (!path || !pathState)
      throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    await this.assertPathRealm(cultivatorId, sect, path, tx);
    let validated: string[];
    try {
      validated = validateMeridianNodeIds({
        path,
        nodeIds,
        unlockedLayerIds: pathState.unlockedLayerIds,
        methods: sect.methods,
      });
    } catch (error) {
      throw new SectError(
        'SECT_INVALID_MERIDIAN',
        error instanceof Error ? error.message : '经脉方案无效',
        400,
      );
    }
    await this.repository.replaceMeridianLoadout(
      sect.membershipId,
      pathId,
      slot,
      validated,
      tx,
    );
    return requireActive(this.repository, cultivatorId, tx);
  }

  async activateMeridianLoadout(
    cultivatorId: string,
    pathId: string,
    slot: number,
    tx: DbTransaction,
  ) {
    if (![1, 2, 3].includes(slot))
      throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(this.repository, cultivatorId, tx);
    const path = this.runtime.registry.require(sect.sectId).definition.paths.find(
      (entry) => entry.id === pathId,
    );
    if (!path || !sect.paths.some((entry) => entry.pathId === pathId))
      throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    await this.assertPathRealm(cultivatorId, sect, path, tx);
    await this.repository.activateMeridianLoadout(
      sect.membershipId,
      pathId,
      slot,
      tx,
    );
    return requireActive(this.repository, cultivatorId, tx);
  }

  async setAbilityLoadout(
    cultivatorId: string,
    rawSlots: Array<string | null>,
    tx: DbTransaction,
  ) {
    const sect = await requireActive(this.repository, cultivatorId, tx);
    const definition = this.runtime.registry.require(sect.sectId).definition;
    if (rawSlots.length !== 4)
      throw new SectError(
        'SECT_INVALID_LOADOUT',
        '神通栏必须包含四个固定槽位',
        400,
      );
    const ids = rawSlots.filter((id): id is string => id !== null);
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => {
        const ability = definition.abilities.find((entry) => entry.id === id);
        return (
          !ability?.occupiesActiveSlot ||
          !isAbilityUnlocked(definition, id, sect)
        );
      })
    ) {
      throw new SectError(
        'SECT_INVALID_LOADOUT',
        '神通栏包含重复、未解锁或非宗门神通',
        400,
      );
    }
    await this.repository.replaceAbilityLoadout(
      sect.membershipId,
      createAbilitySlots(rawSlots as SectAbilitySlots),
      tx,
    );
    return requireActive(this.repository, cultivatorId, tx);
  }

  async setPathTactic(
    cultivatorId: string,
    pathId: string,
    tacticId: string,
    tx: DbTransaction,
  ) {
    const sect = await requireActive(this.repository, cultivatorId, tx);
    const path = this.runtime.registry
      .require(sect.sectId)
      .definition.paths.find((entry) => entry.id === pathId);
    if (!path || !sect.paths.some((entry) => entry.pathId === pathId))
      throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    await this.assertPathRealm(cultivatorId, sect, path, tx);
    if (!path.tactics.some((tactic) => tactic.id === tacticId))
      throw new SectError('SECT_PATH_UNKNOWN', '未知流派战术', 400);
    await this.repository.setPathTactic(
      sect.membershipId,
      pathId,
      tacticId,
      tx,
    );
    return requireActive(this.repository, cultivatorId, tx);
  }
}

export function createSectService(
  dependencies: SectServiceDependencies = {},
): SectApplicationService {
  return new SectApplicationService(
    dependencies.runtime,
    dependencies.repository,
  );
}

export type SectServiceInstance = SectApplicationService;
export const SectService = createSectService();
