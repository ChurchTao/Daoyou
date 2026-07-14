import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import * as sectRepository from '@server/lib/repositories/sectRepository';
import {
  LINGXIAO_ABILITY_BY_ID,
  LINGXIAO_METHOD_BY_ID,
  assertMethodTrainingTarget,
  createAbilitySlots,
  fillFirstEmptyAbilitySlots,
  getSectMethodTrainingCost,
  isAbilityUnlocked,
  listUnlockedAbilityIds,
  validateMeridianNodeIds,
  type CultivatorSectState,
  type LingxiaoAbilityId,
  type LingxiaoMethodId,
  type SectAbilitySlots,
  type SectTacticId,
} from '@shared/engine/sect';
import { REALM_ORDER, type RealmStage, type RealmType } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';

export type SectErrorCode =
  | 'SECT_TRIAL_REQUIRED' | 'SECT_ALREADY_JOINED' | 'SECT_REALM_GATE'
  | 'SECT_METHOD_CAP' | 'SECT_INSUFFICIENT_RESOURCES' | 'SECT_INVALID_MERIDIAN'
  | 'SECT_INVALID_LOADOUT' | 'SECT_SKILL_ONLY_LOADOUT'
  | 'SECT_COMMISSION_ALREADY_CLAIMED';

export class SectError extends Error {
  constructor(public readonly code: SectErrorCode, message: string, public readonly status = 409) { super(message); }
}

async function requireActive(cultivatorId: string, q: DbExecutor | DbTransaction): Promise<CultivatorSectState> {
  const sect = await sectRepository.loadCultivatorSectState(cultivatorId, q);
  if (!sect || sect.status !== 'active') throw new SectError('SECT_TRIAL_REQUIRED', '尚未拜入凌霄剑宗');
  return sect;
}

export class SectService {
  static async getState(cultivatorId: string, q: DbExecutor | DbTransaction) {
    return sectRepository.loadCultivatorSectState(cultivatorId, q);
  }

  static async recordExperience(cultivatorId: string, tx: DbTransaction) {
    const existing = await sectRepository.loadCultivatorSectState(cultivatorId, tx);
    if (existing?.status === 'active') throw new SectError('SECT_ALREADY_JOINED', '已经是凌霄剑宗弟子');
    await sectRepository.recordExperience(cultivatorId, tx);
    return (await sectRepository.loadCultivatorSectState(cultivatorId, tx))!;
  }

  static async join(cultivatorId: string, tx: DbTransaction) {
    const existing = await sectRepository.loadCultivatorSectState(cultivatorId, tx);
    if (existing?.status === 'active') throw new SectError('SECT_ALREADY_JOINED', '已经是凌霄剑宗弟子');
    if (!existing?.experiencedAt) throw new SectError('SECT_TRIAL_REQUIRED', '须先完成山门演剑体验');
    await sectRepository.activateMembership(existing.membershipId, tx);
    return (await sectRepository.loadCultivatorSectState(cultivatorId, tx))!;
  }

  static async trainMethod(args: { cultivatorId: string; methodId: string; targetLevel: number }, tx: DbTransaction) {
    const sect = await requireActive(args.cultivatorId, tx);
    if (!LINGXIAO_METHOD_BY_ID.has(args.methodId as LingxiaoMethodId)) throw new SectError('SECT_METHOD_CAP', '未知宗门心法', 400);
    const [cultivator] = await tx.select({ realm: cultivators.realm, stage: cultivators.realm_stage, stones: cultivators.spirit_stones }).from(cultivators).where(eq(cultivators.id, args.cultivatorId)).limit(1);
    const methodId = args.methodId as LingxiaoMethodId;
    const currentLevel = sect.methods[methodId] ?? 0;
    try {
      assertMethodTrainingTarget({ methodId, currentLevel, targetLevel: args.targetLevel, realm: cultivator.realm as RealmType, stage: cultivator.stage as RealmStage, methods: sect.methods });
    } catch (error) {
      throw new SectError('SECT_METHOD_CAP', error instanceof Error ? error.message : '心法等级受限');
    }
    if (methodId === 'swift-sword-canon' && sect.pathId !== 'swift-sword') throw new SectError('SECT_REALM_GATE', '须先选择快剑道');
    const cost = getSectMethodTrainingCost(currentLevel, args.targetLevel);
    if (sect.contribution < cost.contribution || cultivator.stones < cost.spiritStones) throw new SectError('SECT_INSUFFICIENT_RESOURCES', '宗门贡献或灵石不足');
    if (!(await sectRepository.spendContribution(sect.membershipId, cost.contribution, tx))) throw new SectError('SECT_INSUFFICIENT_RESOURCES', '宗门贡献不足');
    const paid = await tx.update(cultivators).set({ spirit_stones: sql`${cultivators.spirit_stones} - ${cost.spiritStones}` }).where(and(eq(cultivators.id, args.cultivatorId), sql`${cultivators.spirit_stones} >= ${cost.spiritStones}`)).returning({ id: cultivators.id });
    if (!paid.length) throw new SectError('SECT_INSUFFICIENT_RESOURCES', '灵石不足');
    await sectRepository.setMethodLevel(sect.membershipId, methodId, args.targetLevel, tx);
    const trainedSect = await requireActive(args.cultivatorId, tx);
    const unlocked = listUnlockedAbilityIds(trainedSect).filter((id) => LINGXIAO_ABILITY_BY_ID.get(id)?.occupiesActiveSlot);
    const nextLoadout = fillFirstEmptyAbilitySlots(trainedSect.abilityLoadout, unlocked);
    if (nextLoadout.some((abilityId, index) => abilityId !== trainedSect.abilityLoadout[index])) {
      await sectRepository.replaceAbilityLoadout(trainedSect.membershipId, nextLoadout, tx);
    }
    return { sect: (await requireActive(args.cultivatorId, tx)), methodId, targetLevel: args.targetLevel, cost };
  }

  static async selectSwiftPath(cultivatorId: string, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    if (sect.pathId) throw new SectError('SECT_REALM_GATE', '已经选择剑道');
    const [cultivator] = await tx.select({ realm: cultivators.realm }).from(cultivators).where(eq(cultivators.id, cultivatorId)).limit(1);
    if (REALM_ORDER[cultivator.realm as RealmType] < REALM_ORDER['筑基'] || (sect.methods['lingxiao-canon'] ?? 0) < 25) throw new SectError('SECT_REALM_GATE', '筑基且《凌霄剑典》25级后方可择道');
    if (!(await sectRepository.selectSwiftPath(sect.membershipId, tx))) throw new SectError('SECT_REALM_GATE', '无法重复择道');
    return requireActive(cultivatorId, tx);
  }

  static async setMeridianLoadout(cultivatorId: string, slot: number, nodeIds: string[], tx: DbTransaction) {
    if (![1, 2, 3].includes(slot)) throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(cultivatorId, tx);
    if (sect.pathId !== 'swift-sword') throw new SectError('SECT_INVALID_MERIDIAN', '尚未选择快剑道');
    const [cultivator] = await tx.select({ realm: cultivators.realm, stage: cultivators.realm_stage }).from(cultivators).where(eq(cultivators.id, cultivatorId)).limit(1);
    let validated: string[];
    try { validated = validateMeridianNodeIds({ nodeIds, realm: cultivator.realm as RealmType, stage: cultivator.stage as RealmStage, methods: sect.methods }); }
    catch (error) { throw new SectError('SECT_INVALID_MERIDIAN', error instanceof Error ? error.message : '经脉方案无效', 400); }
    await sectRepository.replaceMeridianLoadout(sect.membershipId, slot, validated, tx);
    return requireActive(cultivatorId, tx);
  }

  static async activateMeridianLoadout(cultivatorId: string, slot: number, tx: DbTransaction) {
    if (![1, 2, 3].includes(slot)) throw new SectError('SECT_INVALID_MERIDIAN', '经脉方案槽无效', 400);
    const sect = await requireActive(cultivatorId, tx);
    await sectRepository.activateMeridianLoadout(sect.membershipId, slot, tx);
    return requireActive(cultivatorId, tx);
  }

  static async setAbilityLoadout(cultivatorId: string, rawSlots: Array<string | null>, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    if (rawSlots.length !== 4) throw new SectError('SECT_INVALID_LOADOUT', '神通栏必须包含四个固定槽位', 400);
    const ids = rawSlots.filter((id): id is string => id !== null);
    if (new Set(ids).size !== ids.length || ids.some((id) => id === 'plain-sword' || !LINGXIAO_ABILITY_BY_ID.has(id as LingxiaoAbilityId) || !isAbilityUnlocked(id as LingxiaoAbilityId, sect))) {
      throw new SectError('SECT_INVALID_LOADOUT', '神通栏包含重复、未解锁或非宗门神通', 400);
    }
    const slots = createAbilitySlots(rawSlots as SectAbilitySlots);
    await sectRepository.replaceAbilityLoadout(sect.membershipId, slots, tx);
    return requireActive(cultivatorId, tx);
  }

  static async setTactic(cultivatorId: string, tacticId: SectTacticId, tx: DbTransaction) {
    const sect = await requireActive(cultivatorId, tx);
    await sectRepository.setTactic(sect.membershipId, tacticId, tx);
    return requireActive(cultivatorId, tx);
  }
}
