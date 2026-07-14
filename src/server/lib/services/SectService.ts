import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { postgresSectRepository, type SectRepositoryPort } from '@server/lib/repositories/sectRepository';
import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  assertMethodTrainingTarget,
  assertPathTrainingTarget,
  createAbilitySlots,
  fillFirstEmptyAbilitySlots,
  getSectMethodTrainingCost,
  isAbilityUnlocked,
  listUnlockedAbilityIds,
  productionSectRuntime,
  validateMeridianNodeIds,
  type CultivatorSectState,
  type SectAbilitySlots,
  type SectAdmissionContext,
  type SectRuntime,
} from '@shared/engine/sect';
import type { Cultivator } from '@shared/types/cultivator';

export type SectErrorCode =
  | 'SECT_UNKNOWN' | 'SECT_TRIAL_REQUIRED' | 'SECT_ALREADY_JOINED' | 'SECT_REALM_GATE'
  | 'SECT_METHOD_CAP' | 'SECT_PATH_UNKNOWN' | 'SECT_PATH_NOT_LEARNED' | 'SECT_PATH_ALREADY_LEARNED'
  | 'SECT_INSUFFICIENT_RESOURCES' | 'SECT_INVALID_MERIDIAN' | 'SECT_INVALID_LOADOUT'
  | 'SECT_COMMISSION_ALREADY_CLAIMED';

export class SectError extends Error {
  constructor(public readonly code: SectErrorCode, message: string, public readonly status = 409) { super(message); }
}

async function requireActive(repository: SectRepositoryPort, cultivatorId: string, q: DbExecutor | DbTransaction): Promise<CultivatorSectState> {
  const sect = await repository.loadCultivatorSectState(cultivatorId, q);
  if (!sect || sect.status !== 'active') throw new SectError('SECT_TRIAL_REQUIRED', '尚未拜入宗门');
  return sect;
}

async function getCultivatorProgress(repository: SectRepositoryPort, cultivatorId: string, q: DbExecutor | DbTransaction) {
  const cultivator = await repository.loadCultivatorProgress(cultivatorId, q);
  if (!cultivator) throw new SectError('SECT_REALM_GATE', '角色不存在', 400);
  return cultivator;
}

async function payTrainingCost(
  sect: CultivatorSectState,
  cultivatorId: string,
  fromLevel: number,
  targetLevel: number,
  tx: DbTransaction,
  repository: SectRepositoryPort,
) {
  const cost = getSectMethodTrainingCost(fromLevel, targetLevel);
  if (sect.contribution < cost.contribution) throw new SectError('SECT_INSUFFICIENT_RESOURCES', '宗门贡献不足');
  if (!(await repository.spendContribution(sect.membershipId, cost.contribution, tx))) {
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '宗门贡献不足');
  }
  if (!(await repository.spendSpiritStones(cultivatorId, cost.spiritStones, tx))) {
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '灵石不足');
  }
  return cost;
}

export function createSectService(dependencies: {
  runtime?: SectRuntime;
  repository?: SectRepositoryPort;
} = {}) {
  const runtime = dependencies.runtime ?? productionSectRuntime;
  const repository = dependencies.repository ?? postgresSectRepository;
  const assertAdmission = async (cultivatorId: string, sectId: string, q: DbExecutor | DbTransaction) => {
    const module = runtime.registry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const progress = await getCultivatorProgress(repository, cultivatorId, q);
    const result = module.checkAdmission(progress);
    if (!result.allowed) throw new SectError('SECT_REALM_GATE', result.reason ?? '不符合宗门准入条件');
    return module;
  };

  return {
  listDefinitions() {
    return runtime.registry.listDefinitions();
  },

  listAvailableDefinitions(context: SectAdmissionContext) {
    return runtime.registry.listDefinitions().filter((definition) =>
      runtime.registry.require(definition.id).checkAdmission(context).allowed);
  },

  createTrialScenario(sectId: string, cultivator: Cultivator) {
    const module = runtime.registry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const admission = module.checkAdmission({
      playerRace: cultivator.playerRace ?? 'human',
      realm: cultivator.realm,
      stage: cultivator.realm_stage,
    });
    if (!admission.allowed) throw new SectError('SECT_REALM_GATE', admission.reason ?? '不符合宗门准入条件');
    return module.createTrialScenario({ cultivator });
  },

  listMemberships(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return repository.listMemberships(cultivatorId, q);
  },

  getState(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return repository.loadCultivatorSectState(cultivatorId, q);
  },

  getStateForSect(cultivatorId: string, sectId: string, q: DbExecutor | DbTransaction) {
    if (!runtime.registry.get(sectId)) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    return repository.loadCultivatorSectStateForSect(cultivatorId, sectId, q);
  },

  async recordExperience(cultivatorId: string, sectId: string, tx: DbTransaction) {
    const module = await assertAdmission(cultivatorId, sectId, tx);
    const active = await repository.findMembership(cultivatorId, tx);
    if (active) throw new SectError('SECT_ALREADY_JOINED', `已经是${runtime.registry.require(active.sectId).definition.name}弟子`);
    await repository.recordExperience(cultivatorId, sectId, module.definition.configVersion, tx);
    return (await repository.loadCultivatorSectStateForSect(cultivatorId, sectId, tx))!;
  },

  async join(cultivatorId: string, sectId: string, tx: DbTransaction) {
    const module = await assertAdmission(cultivatorId, sectId, tx);
    const active = await repository.findMembership(cultivatorId, tx);
    if (active) throw new SectError('SECT_ALREADY_JOINED', `已经是${runtime.registry.require(active.sectId).definition.name}弟子`);
    const prospect = await repository.findMembershipForSect(cultivatorId, sectId, tx);
    if (!prospect?.experiencedAt) throw new SectError('SECT_TRIAL_REQUIRED', '须先完成该宗门入门试炼');
    await repository.activateMembership(prospect.id, module.definition, tx);
    return (await repository.loadCultivatorSectState(cultivatorId, tx))!;
  },

  async trainMethod(args: { cultivatorId: string; methodId: string; targetLevel: number }, tx: DbTransaction) {
    const sect = await requireActive(repository, args.cultivatorId, tx);
    const definition = runtime.registry.require(sect.sectId).definition;
    const cultivator = await getCultivatorProgress(repository, args.cultivatorId, tx);
    const currentLevel = sect.methods[args.methodId] ?? 0;
    try {
      assertMethodTrainingTarget({ definition, methodId: args.methodId, currentLevel, targetLevel: args.targetLevel, realm: cultivator.realm, stage: cultivator.stage, methods: sect.methods });
    } catch (error) {
      throw new SectError('SECT_METHOD_CAP', error instanceof Error ? error.message : '心法等级受限', 400);
    }
    const cost = await payTrainingCost(sect, args.cultivatorId, currentLevel, args.targetLevel, tx, repository);
    await repository.setMethodLevel(sect.membershipId, args.methodId, args.targetLevel, tx);
    const trained = await requireActive(repository, args.cultivatorId, tx);
    const unlocked = listUnlockedAbilityIds(definition, trained)
      .filter((id) => definition.abilities.find((ability) => ability.id === id)?.occupiesActiveSlot);
    const nextLoadout = fillFirstEmptyAbilitySlots(trained.abilityLoadout, unlocked);
    if (nextLoadout.some((id, index) => id !== trained.abilityLoadout[index])) {
      await repository.replaceAbilityLoadout(trained.membershipId, nextLoadout, tx);
    }
    return { sect: await requireActive(repository, args.cultivatorId, tx), methodId: args.methodId, targetLevel: args.targetLevel, cost };
  },

  async enrollPath(cultivatorId: string, pathId: string, tx: DbTransaction) {
    const sect = await requireActive(repository, cultivatorId, tx);
    const path = runtime.registry.require(sect.sectId).definition.paths.find((entry) => entry.id === pathId);
    if (!path) throw new SectError('SECT_PATH_UNKNOWN', '未知流派', 400);
    const cultivator = await getCultivatorProgress(repository, cultivatorId, tx);
    if (getRealmStageRank(cultivator.realm, cultivator.stage) < getRealmStageRank('筑基', '初期')) {
      throw new SectError('SECT_REALM_GATE', '筑基初期后方可研习流派');
    }
    if (!(await repository.enrollPath(sect.membershipId, pathId, path.defaultTacticId, tx))) {
      throw new SectError('SECT_PATH_ALREADY_LEARNED', '该流派已经习得');
    }
    return requireActive(repository, cultivatorId, tx);
  },

  async trainPath(args: { cultivatorId: string; pathId: string; targetLevel: number }, tx: DbTransaction) {
    const sect = await requireActive(repository, args.cultivatorId, tx);
    const pathState = sect.paths.find((path) => path.pathId === args.pathId);
    if (!pathState) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    const cultivator = await getCultivatorProgress(repository, args.cultivatorId, tx);
    try {
      assertPathTrainingTarget({ currentLevel: pathState.level, targetLevel: args.targetLevel, realm: cultivator.realm, stage: cultivator.stage });
    } catch (error) {
      throw new SectError('SECT_METHOD_CAP', error instanceof Error ? error.message : '流派等级受限', 400);
    }
    const cost = await payTrainingCost(sect, args.cultivatorId, pathState.level, args.targetLevel, tx, repository);
    await repository.setPathLevel(sect.membershipId, args.pathId, args.targetLevel, tx);
    return { sect: await requireActive(repository, args.cultivatorId, tx), pathId: args.pathId, targetLevel: args.targetLevel, cost };
  },

  async activatePath(cultivatorId: string, pathId: string, tx: DbTransaction) {
    const sect = await requireActive(repository, cultivatorId, tx);
    if (!(await repository.activatePath(sect.membershipId, pathId, tx))) {
      throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    }
    return requireActive(repository, cultivatorId, tx);
  },

  async setMeridianLoadout(cultivatorId: string, pathId: string, slot: number, nodeIds: string[], tx: DbTransaction) {
    if (![1, 2, 3].includes(slot)) throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(repository, cultivatorId, tx);
    const definition = runtime.registry.require(sect.sectId).definition;
    const path = definition.paths.find((entry) => entry.id === pathId);
    const pathState = sect.paths.find((entry) => entry.pathId === pathId);
    if (!path || !pathState) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    const cultivator = await getCultivatorProgress(repository, cultivatorId, tx);
    let validated: string[];
    try {
      validated = validateMeridianNodeIds({ path, nodeIds, pathLevel: pathState.level, realm: cultivator.realm, stage: cultivator.stage, methods: sect.methods });
    } catch (error) {
      throw new SectError('SECT_INVALID_MERIDIAN', error instanceof Error ? error.message : '经脉方案无效', 400);
    }
    await repository.replaceMeridianLoadout(sect.membershipId, pathId, slot, validated, tx);
    return requireActive(repository, cultivatorId, tx);
  },

  async activateMeridianLoadout(cultivatorId: string, pathId: string, slot: number, tx: DbTransaction) {
    if (![1, 2, 3].includes(slot)) throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(repository, cultivatorId, tx);
    if (!sect.paths.some((path) => path.pathId === pathId)) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    await repository.activateMeridianLoadout(sect.membershipId, pathId, slot, tx);
    return requireActive(repository, cultivatorId, tx);
  },

  async setAbilityLoadout(cultivatorId: string, rawSlots: Array<string | null>, tx: DbTransaction) {
    const sect = await requireActive(repository, cultivatorId, tx);
    const definition = runtime.registry.require(sect.sectId).definition;
    if (rawSlots.length !== 4) throw new SectError('SECT_INVALID_LOADOUT', '神通栏必须包含四个固定槽位', 400);
    const ids = rawSlots.filter((id): id is string => id !== null);
    if (new Set(ids).size !== ids.length || ids.some((id) => {
      const ability = definition.abilities.find((entry) => entry.id === id);
      return !ability?.occupiesActiveSlot || !isAbilityUnlocked(definition, id, sect);
    })) {
      throw new SectError('SECT_INVALID_LOADOUT', '神通栏包含重复、未解锁或非宗门神通', 400);
    }
    await repository.replaceAbilityLoadout(sect.membershipId, createAbilitySlots(rawSlots as SectAbilitySlots), tx);
    return requireActive(repository, cultivatorId, tx);
  },

  async setPathTactic(cultivatorId: string, pathId: string, tacticId: string, tx: DbTransaction) {
    const sect = await requireActive(repository, cultivatorId, tx);
    const path = runtime.registry.require(sect.sectId).definition.paths.find((entry) => entry.id === pathId);
    if (!path || !sect.paths.some((entry) => entry.pathId === pathId)) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    if (!path.tactics.some((tactic) => tactic.id === tacticId)) throw new SectError('SECT_PATH_UNKNOWN', '未知流派战术', 400);
    await repository.setPathTactic(sect.membershipId, pathId, tacticId, tx);
    return requireActive(repository, cultivatorId, tx);
  },
  };
}

export type SectServiceInstance = ReturnType<typeof createSectService>;
export const SectService = createSectService();
