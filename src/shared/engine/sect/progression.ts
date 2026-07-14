import { getRealmStageRank } from '@shared/config/realmProgression';
import { REALM_STAGE_VALUES, REALM_VALUES, type RealmStage, type RealmType } from '@shared/types/constants';
import type {
  CultivatorSectState,
  SectAbilityId,
  SectDefinition,
  SectMeridianLayer,
  SectMethodId,
  SectPathDefinition,
} from './types';

export const SECT_MERIDIAN_STAGES = [
  { layer: 1 as const, label: '第一层', realm: '筑基' as const, stage: '初期' as const, pathLevel: 5 },
  { layer: 2 as const, label: '第二层', realm: '筑基' as const, stage: '圆满' as const, pathLevel: 15 },
  { layer: 3 as const, label: '第三层', realm: '金丹' as const, stage: '圆满' as const, pathLevel: 30 },
  { layer: 4 as const, label: '第四层', realm: '元婴' as const, stage: '圆满' as const, pathLevel: 50 },
  { layer: 5 as const, label: '第五层', realm: '化神' as const, stage: '中期' as const, pathLevel: 70 },
  { layer: 'ultimate' as const, label: '终式', realm: '化神' as const, stage: '圆满' as const, pathLevel: 100 },
] as const;

export function getSectMethodLevelCap(realm: RealmType, stage: RealmStage): number {
  return (getRealmStageRank(realm, stage) + 1) * 5;
}

export function getMinimumRealmStageForMethodLevel(level: number): { realm: RealmType; stage: RealmStage } {
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
  definition: SectDefinition,
  abilityId: SectAbilityId,
  sect: CultivatorSectState,
): boolean {
  const ability = definition.abilities.find((entry) => entry.id === abilityId);
  if (!ability || sect.status !== 'active') return false;
  return (sect.methods[ability.methodId] ?? 0) >= ability.unlockLevel;
}

export function listUnlockedAbilityIds(definition: SectDefinition, sect: CultivatorSectState): SectAbilityId[] {
  return definition.abilities
    .filter((ability) => isAbilityUnlocked(definition, ability.id, sect))
    .map((ability) => ability.id);
}

export function getPathProgress(args: {
  path: SectPathDefinition;
  pathLevel: number;
  realm: RealmType;
  stage: RealmStage;
}) {
  const currentRank = getRealmStageRank(args.realm, args.stage);
  const availableLayers = SECT_MERIDIAN_STAGES.filter(
    (entry) => args.pathLevel >= entry.pathLevel && currentRank >= getRealmStageRank(entry.realm, entry.stage),
  ).map((entry) => entry.layer);
  const nextStage = SECT_MERIDIAN_STAGES.find((entry) => !availableLayers.includes(entry.layer));
  const ordinaryLayers = availableLayers.filter((layer): layer is 1 | 2 | 3 | 4 | 5 => layer !== 'ultimate');
  return {
    availableLayers,
    highestOpenLayer: ordinaryLayers[ordinaryLayers.length - 1] ?? null,
    ultimateAvailable: availableLayers.includes('ultimate'),
    nextStage: nextStage ?? null,
  };
}

export function isMeridianLayerAvailable(layer: SectMeridianLayer, progress: ReturnType<typeof getPathProgress>) {
  return progress.availableLayers.includes(layer);
}

export function validateMeridianNodeIds(args: {
  path: SectPathDefinition;
  nodeIds: string[];
  pathLevel: number;
  realm: RealmType;
  stage: RealmStage;
  methods: Partial<Record<SectMethodId, number>>;
}): string[] {
  const uniqueIds = Array.from(new Set(args.nodeIds));
  if (uniqueIds.length !== args.nodeIds.length) throw new Error('经脉节点不可重复');
  const occupiedLayers = new Set<string>();
  const currentRank = getRealmStageRank(args.realm, args.stage);
  for (const nodeId of uniqueIds) {
    const node = args.path.nodes.find((entry) => entry.id === nodeId);
    if (!node) throw new Error(`未知经脉节点: ${nodeId}`);
    const layer = String(node.layer);
    if (occupiedLayers.has(layer)) throw new Error(`经脉第${layer}层只能选择一个节点`);
    occupiedLayers.add(layer);
    if (node.minPathLevel !== undefined && args.pathLevel < node.minPathLevel) throw new Error(`${node.name}尚未达到流派等级要求`);
    if (node.minRealm && node.minRealmStage && currentRank < getRealmStageRank(node.minRealm, node.minRealmStage)) {
      throw new Error(`${node.name}尚未达到境界要求`);
    }
    for (const [methodId, level] of Object.entries(node.requiredMethods ?? {})) {
      if ((args.methods[methodId] ?? 0) < level) throw new Error(`${node.name}尚未达到心法要求`);
    }
  }
  return uniqueIds;
}

export function assertMethodTrainingTarget(args: {
  definition: SectDefinition;
  methodId: SectMethodId;
  currentLevel: number;
  targetLevel: number;
  realm: RealmType;
  stage: RealmStage;
  methods: Partial<Record<SectMethodId, number>>;
}) {
  const method = args.definition.methods.find((entry) => entry.id === args.methodId);
  if (!method) throw new Error('未知宗门心法');
  if (!Number.isInteger(args.targetLevel) || args.targetLevel <= args.currentLevel) {
    throw new Error('目标心法等级必须高于当前等级');
  }
  if (args.targetLevel > getSectMethodLevelCap(args.realm, args.stage)) throw new Error('心法等级超过当前境界上限');
  const primary = args.definition.methods.find((entry) => entry.isPrimary);
  if (primary && method.id !== primary.id && args.targetLevel > (args.methods[primary.id] ?? 0)) {
    throw new Error(`分卷等级不得超过${primary.name}`);
  }
}

export function assertPathTrainingTarget(args: {
  currentLevel: number;
  targetLevel: number;
  realm: RealmType;
  stage: RealmStage;
}) {
  if (!Number.isInteger(args.targetLevel) || args.targetLevel <= args.currentLevel) {
    throw new Error('目标流派等级必须高于当前等级');
  }
  if (args.targetLevel > getSectMethodLevelCap(args.realm, args.stage)) throw new Error('流派等级超过当前境界上限');
}
