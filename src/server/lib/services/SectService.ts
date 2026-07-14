import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import * as sectRepository from '@server/lib/repositories/sectRepository';
import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  assertMethodTrainingTarget,
  assertPathTrainingTarget,
  createAbilitySlots,
  fillFirstEmptyAbilitySlots,
  getSectMethodTrainingCost,
  isAbilityUnlocked,
  listUnlockedAbilityIds,
  sectRegistry,
  validateMeridianNodeIds,
  type CultivatorSectState,
  type SectAbilitySlots,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';

export type SectErrorCode =
  | 'SECT_UNKNOWN' | 'SECT_TRIAL_REQUIRED' | 'SECT_ALREADY_JOINED' | 'SECT_REALM_GATE'
  | 'SECT_METHOD_CAP' | 'SECT_PATH_UNKNOWN' | 'SECT_PATH_NOT_LEARNED' | 'SECT_PATH_ALREADY_LEARNED'
  | 'SECT_INSUFFICIENT_RESOURCES' | 'SECT_INVALID_MERIDIAN' | 'SECT_INVALID_LOADOUT'
  | 'SECT_COMMISSION_ALREADY_CLAIMED';

export class SectError extends Error {
  constructor(public readonly code: SectErrorCode, message: string, public readonly status = 409) { super(message); }
}

async function requireActive(cultivatorId: string, q: DbExecutor | DbTransaction): Promise<CultivatorSectState> {
  const sect = await sectRepository.loadCultivatorSectState(cultivatorId, q);
  if (!sect || sect.status !== 'active') throw new SectError('SECT_TRIAL_REQUIRED', '尚未拜入宗门');
  return sect;
}

async function getCultivatorProgress(cultivatorId: string, q: DbExecutor | DbTransaction) {
  const [cultivator] = await q.select({ realm: cultivators.realm, stage: cultivators.realm_stage, stones: cultivators.spirit_stones })
    .from(cultivators).where(eq(cultivators.id, cultivatorId)).limit(1);
  if (!cultivator) throw new SectError('SECT_REALM_GATE', '角色不存在', 400);
  return cultivator as { realm: RealmType; stage: RealmStage; stones: number };
}

async function payTrainingCost(
  sect: CultivatorSectState,
  cultivatorId: string,
  fromLevel: number,
  targetLevel: number,
  tx: DbTransaction,
) {
  const cost = getSectMethodTrainingCost(fromLevel, targetLevel);
  if (sect.contribution < cost.contribution) throw new SectError('SECT_INSUFFICIENT_RESOURCES', '宗门贡献不足');
  if (!(await sectRepository.spendContribution(sect.membershipId, cost.contribution, tx))) {
    throw new SectError('SECT_INSUFFICIENT_RESOURCES', '宗门贡献不足');
  }
  const paid = await tx.update(cultivators).set({ spirit_stones: sql`${cultivators.spirit_stones} - ${cost.spiritStones}` })
    .where(and(eq(cultivators.id, cultivatorId), sql`${cultivators.spirit_stones} >= ${cost.spiritStones}`))
    .returning({ id: cultivators.id });
  if (!paid.length) throw new SectError('SECT_INSUFFICIENT_RESOURCES', '灵石不足');
  return cost;
}

export class SectService {
  static listDefinitions() {
    return sectRegistry.listDefinitions();
  }

  static listMemberships(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return sectRepository.listMemberships(cultivatorId, q);
  }

  static getState(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return sectRepository.loadCultivatorSectState(cultivatorId, q);
  }

  static getStateForSect(cultivatorId: string, sectId: string, q: DbExecutor | DbTransaction) {
    if (!sectRegistry.get(sectId)) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    return sectRepository.loadCultivatorSectStateForSect(cultivatorId, sectId, q);
  }

  static async recordExperience(cultivatorId: string, sectId: string, tx: DbTransaction) {
    const module = sectRegistry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const active = await sectRepository.findMembership(cultivatorId, tx);
    if (active) throw new SectError('SECT_ALREADY_JOINED', `已经是${sectRegistry.require(active.sectId).definition.name}弟子`);
    await sectRepository.recordExperience(cultivatorId, sectId, module.definition.configVersion, tx);
    return (await sectRepository.loadCultivatorSectStateForSect(cultivatorId, sectId, tx))!;
  }

  static async join(cultivatorId: string, sectId: string, tx: DbTransaction) {
    const module = sectRegistry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const active = await sectRepository.findMembership(cultivatorId, tx);
    if (active) throw new SectError('SECT_ALREADY_JOINED', `已经是${sectRegistry.require(active.sectId).definition.name}弟子`);
    const prospect = await sectRepository.findMembershipForSect(cultivatorId, sectId, tx);
    if (!prospect?.experiencedAt) throw new SectError('SECT_TRIAL_REQUIRED', '须先完成该宗门入门试炼');
    await sectRepository.activateMembership(prospect.id, module.definition, tx);
    return (await sectRepository.loadCultivatorSectState(cultivatorId, tx))!;
  }

  static async trainMethod(args: { cultivatorId: string; methodId: string; targetLevel: number }, tx: DbTransaction) {
    const sect = await requireActive(args.cultivatorId, tx);
    const definition = sectRegistry.require(sect.sectId).definition;
    const cultivator = await getCultivatorProgress(args.cultivatorId, tx);
    const currentLevel = sect.methods[args.methodId] ?? 0;
    try {
      assertMethodTrainingTarget({ definition, methodId: args.methodId, currentLevel, targetLevel: args.targetLevel, realm: cultivator.realm, stage: cultivator.stage, methods: sect.methods });
    } catch (error) {
      throw new SectError('SECT_METHOD_CAP', error instanceof Error ? error.message : '心法等级受限', 400);
    }
    const cost = await payTrainingCost(sect, args.cultivatorId, currentLevel, args.targetLevel, tx);
    await sectRepository.setMethodLevel(sect.membershipId, args.methodId, args.targetLevel, tx);
    const trained = await requireActive(args.cultivatorId, tx);
    const unlocked = listUnlockedAbilityIds(definition, trained)
      .filter((id) => definition.abilities.find((ability) => ability.id === id)?.occupiesActiveSlot);
    const nextLoadout = fillFirstEmptyAbilitySlots(trained.abilityLoadout, unlocked);
    if (nextLoadout.some((id, index) => id !== trained.abilityLoadout[index])) {
      await sectRepository.replaceAbilityLoadout(trained.membershipId, nextLoadout, tx);
    }
    return { sect: await requireActive(args.cultivatorId, tx), methodId: args.methodId, targetLevel: args.targetLevel, cost };
  }

  static async enrollPath(cultivatorId: string, pathId: string, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    const path = sectRegistry.require(sect.sectId).definition.paths.find((entry) => entry.id === pathId);
    if (!path) throw new SectError('SECT_PATH_UNKNOWN', '未知流派', 400);
    const cultivator = await getCultivatorProgress(cultivatorId, tx);
    if (getRealmStageRank(cultivator.realm, cultivator.stage) < getRealmStageRank('筑基', '初期')) {
      throw new SectError('SECT_REALM_GATE', '筑基初期后方可研习流派');
    }
    if (!(await sectRepository.enrollPath(sect.membershipId, pathId, path.defaultTacticId, tx))) {
      throw new SectError('SECT_PATH_ALREADY_LEARNED', '该流派已经习得');
    }
    return requireActive(cultivatorId, tx);
  }

  static async trainPath(args: { cultivatorId: string; pathId: string; targetLevel: number }, tx: DbTransaction) {
    const sect = await requireActive(args.cultivatorId, tx);
    const pathState = sect.paths.find((path) => path.pathId === args.pathId);
    if (!pathState) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    const cultivator = await getCultivatorProgress(args.cultivatorId, tx);
    try {
      assertPathTrainingTarget({ currentLevel: pathState.level, targetLevel: args.targetLevel, realm: cultivator.realm, stage: cultivator.stage });
    } catch (error) {
      throw new SectError('SECT_METHOD_CAP', error instanceof Error ? error.message : '流派等级受限', 400);
    }
    const cost = await payTrainingCost(sect, args.cultivatorId, pathState.level, args.targetLevel, tx);
    await sectRepository.setPathLevel(sect.membershipId, args.pathId, args.targetLevel, tx);
    return { sect: await requireActive(args.cultivatorId, tx), pathId: args.pathId, targetLevel: args.targetLevel, cost };
  }

  static async activatePath(cultivatorId: string, pathId: string, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    if (!(await sectRepository.activatePath(sect.membershipId, pathId, tx))) {
      throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    }
    return requireActive(cultivatorId, tx);
  }

  static async setMeridianLoadout(cultivatorId: string, pathId: string, slot: number, nodeIds: string[], tx: DbTransaction) {
    if (![1, 2, 3].includes(slot)) throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(cultivatorId, tx);
    const definition = sectRegistry.require(sect.sectId).definition;
    const path = definition.paths.find((entry) => entry.id === pathId);
    const pathState = sect.paths.find((entry) => entry.pathId === pathId);
    if (!path || !pathState) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    const cultivator = await getCultivatorProgress(cultivatorId, tx);
    let validated: string[];
    try {
      validated = validateMeridianNodeIds({ path, nodeIds, pathLevel: pathState.level, realm: cultivator.realm, stage: cultivator.stage, methods: sect.methods });
    } catch (error) {
      throw new SectError('SECT_INVALID_MERIDIAN', error instanceof Error ? error.message : '经脉方案无效', 400);
    }
    await sectRepository.replaceMeridianLoadout(sect.membershipId, pathId, slot, validated, tx);
    return requireActive(cultivatorId, tx);
  }

  static async activateMeridianLoadout(cultivatorId: string, pathId: string, slot: number, tx: DbTransaction) {
    if (![1, 2, 3].includes(slot)) throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(cultivatorId, tx);
    if (!sect.paths.some((path) => path.pathId === pathId)) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    await sectRepository.activateMeridianLoadout(sect.membershipId, pathId, slot, tx);
    return requireActive(cultivatorId, tx);
  }

  static async setAbilityLoadout(cultivatorId: string, rawSlots: Array<string | null>, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    const definition = sectRegistry.require(sect.sectId).definition;
    if (rawSlots.length !== 4) throw new SectError('SECT_INVALID_LOADOUT', '神通栏必须包含四个固定槽位', 400);
    const ids = rawSlots.filter((id): id is string => id !== null);
    if (new Set(ids).size !== ids.length || ids.some((id) => {
      const ability = definition.abilities.find((entry) => entry.id === id);
      return !ability?.occupiesActiveSlot || !isAbilityUnlocked(definition, id, sect);
    })) {
      throw new SectError('SECT_INVALID_LOADOUT', '神通栏包含重复、未解锁或非宗门神通', 400);
    }
    await sectRepository.replaceAbilityLoadout(sect.membershipId, createAbilitySlots(rawSlots as SectAbilitySlots), tx);
    return requireActive(cultivatorId, tx);
  }

  static async setPathTactic(cultivatorId: string, pathId: string, tacticId: string, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    const path = sectRegistry.require(sect.sectId).definition.paths.find((entry) => entry.id === pathId);
    if (!path || !sect.paths.some((entry) => entry.pathId === pathId)) throw new SectError('SECT_PATH_NOT_LEARNED', '尚未习得该流派');
    if (!path.tactics.some((tactic) => tactic.id === tacticId)) throw new SectError('SECT_PATH_UNKNOWN', '未知流派战术', 400);
    await sectRepository.setPathTactic(sect.membershipId, pathId, tacticId, tx);
    return requireActive(cultivatorId, tx);
  }
}
