import { getRealmStageRank } from '@shared/config/realmProgression';
import { REALM_ORDER, REALM_STAGE_VALUES, REALM_VALUES, type RealmStage, type RealmType } from '@shared/types/constants';
import { LINGXIAO_ABILITY_BY_ID, LINGXIAO_METHOD_BY_ID, LINGXIAO_NODE_BY_ID } from './lingxiao';
import type { CultivatorSectState, LingxiaoAbilityId, LingxiaoMethodId } from './types';

export function getSectMethodLevelCap(realm: RealmType, stage: RealmStage): number {
  return (getRealmStageRank(realm, stage) + 1) * 5;
}

export function getMinimumRealmStageForMethodLevel(level: number): {
  realm: RealmType;
  stage: RealmStage;
} {
  for (const realm of REALM_VALUES) {
    for (const stage of REALM_STAGE_VALUES) {
      if (getSectMethodLevelCap(realm, stage) >= level) return { realm, stage };
    }
  }
  return { realm: '渡劫', stage: '圆满' };
}

export function getSectMethodTrainingCost(fromLevel: number, targetLevel: number) {
  let contribution = 0;
  let spiritStones = 0;
  for (let level = fromLevel + 1; level <= targetLevel; level += 1) {
    contribution += 1 + Math.floor((level - 1) / 30);
    spiritStones += 50 * (1 + Math.floor((level - 1) / 20));
  }
  return { contribution, spiritStones };
}

export function isAbilityUnlocked(
  abilityId: LingxiaoAbilityId,
  sect: CultivatorSectState,
): boolean {
  const definition = LINGXIAO_ABILITY_BY_ID.get(abilityId);
  if (!definition || sect.status !== 'active') return false;
  if ((sect.methods[definition.unlock.methodId] ?? 0) < definition.unlock.level) return false;
  if (definition.unlock.pathId && sect.pathId !== definition.unlock.pathId) return false;
  if (
    definition.unlock.primaryMethodLevel &&
    (sect.methods['lingxiao-canon'] ?? 0) < definition.unlock.primaryMethodLevel
  ) return false;
  return true;
}

export function listUnlockedAbilityIds(sect: CultivatorSectState): LingxiaoAbilityId[] {
  return Array.from(LINGXIAO_ABILITY_BY_ID.keys()).filter((abilityId) =>
    isAbilityUnlocked(abilityId, sect),
  );
}

export function validateMeridianNodeIds(args: {
  nodeIds: string[];
  realm: RealmType;
  stage: RealmStage;
  methods: Partial<Record<LingxiaoMethodId, number>>;
}): string[] {
  const uniqueIds = Array.from(new Set(args.nodeIds));
  if (uniqueIds.length !== args.nodeIds.length) throw new Error('经脉节点不可重复');
  const occupiedLayers = new Set<string>();
  for (const nodeId of uniqueIds) {
    const node = LINGXIAO_NODE_BY_ID.get(nodeId);
    if (!node) throw new Error(`未知经脉节点: ${nodeId}`);
    const layer = String(node.layer);
    if (occupiedLayers.has(layer)) throw new Error(`经脉第${layer}层只能选择一个节点`);
    occupiedLayers.add(layer);
    const realmEnough = REALM_ORDER[args.realm] > REALM_ORDER[node.minRealm] ||
      (args.realm === node.minRealm && REALM_STAGE_VALUES.indexOf(args.stage) >= REALM_STAGE_VALUES.indexOf(node.minRealmStage));
    if (!realmEnough) throw new Error(`${node.name}尚未达到境界要求`);
    for (const [methodId, level] of Object.entries(node.requiredMethods ?? {})) {
      if ((args.methods[methodId as LingxiaoMethodId] ?? 0) < (level ?? 0)) {
        throw new Error(`${node.name}尚未达到心法要求`);
      }
    }
  }
  return uniqueIds;
}

export function assertMethodTrainingTarget(args: {
  methodId: LingxiaoMethodId;
  currentLevel: number;
  targetLevel: number;
  realm: RealmType;
  stage: RealmStage;
  methods: Partial<Record<LingxiaoMethodId, number>>;
}) {
  if (!LINGXIAO_METHOD_BY_ID.has(args.methodId)) throw new Error('未知宗门心法');
  if (!Number.isInteger(args.targetLevel) || args.targetLevel <= args.currentLevel) {
    throw new Error('目标心法等级必须高于当前等级');
  }
  const cap = getSectMethodLevelCap(args.realm, args.stage);
  if (args.targetLevel > cap) throw new Error('心法等级超过当前境界上限');
  if (
    args.methodId !== 'lingxiao-canon' &&
    args.targetLevel > (args.methods['lingxiao-canon'] ?? 0)
  ) throw new Error('分卷等级不得超过《凌霄剑典》');
}
