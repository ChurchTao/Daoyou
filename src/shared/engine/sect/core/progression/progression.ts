import type { RealmStage, RealmType } from '@shared/types/constants';
import type {
  CultivatorSectState,
  SectAbilityId,
  SectDefinition,
  SectMethodId,
  SectPathDefinition,
} from '../domain';
import {
  STANDARD_PATH_LAYERS,
  standardSectProgression,
} from './StandardSectProgressionPolicy';

/** 兼容展示层的标准层级导出；具体流派仍以自身 definition.layers 为准。 */
export const SECT_MERIDIAN_STAGES = STANDARD_PATH_LAYERS;

export function getSectMethodLevelCap(
  realm: RealmType,
  stage: RealmStage,
): number {
  return standardSectProgression.methodLevelCap(realm, stage);
}

export function getMinimumRealmStageForMethodLevel(level: number): {
  realm: RealmType;
  stage: RealmStage;
} {
  return standardSectProgression.minimumRealmStageForMethodLevel(level);
}

export function getSectMethodTrainingCost(
  fromLevel: number,
  targetLevel: number,
) {
  return standardSectProgression.methodTrainingCost(fromLevel, targetLevel);
}

export function getPathProgress(args: {
  path: SectPathDefinition;
  unlockedLayerIds: string[];
  realm: RealmType;
  stage: RealmStage;
  methods?: Partial<Record<SectMethodId, number>>;
}) {
  return standardSectProgression.pathProgress({
    ...args,
    methods: args.methods ?? {},
  });
}

export function isMeridianLayerAvailable(
  layerId: string,
  progress: ReturnType<typeof getPathProgress>,
) {
  return progress.unlockedLayers.some((layer) => layer.id === layerId);
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

export function listUnlockedAbilityIds(
  definition: SectDefinition,
  sect: CultivatorSectState,
): SectAbilityId[] {
  return definition.abilities
    .filter((ability) => isAbilityUnlocked(definition, ability.id, sect))
    .map((ability) => ability.id);
}

export function validateMeridianNodeIds(args: {
  path: SectPathDefinition;
  nodeIds: string[];
  unlockedLayerIds: string[];
  methods: Partial<Record<SectMethodId, number>>;
}): string[] {
  const uniqueIds = Array.from(new Set(args.nodeIds));
  if (uniqueIds.length !== args.nodeIds.length)
    throw new Error('经脉节点不可重复');
  const unlockedLayers = new Set(args.unlockedLayerIds);
  const occupiedLayers = new Set<string>();
  for (const nodeId of uniqueIds) {
    const node = args.path.nodes.find((entry) => entry.id === nodeId);
    if (!node) throw new Error(`未知经脉节点: ${nodeId}`);
    if (occupiedLayers.has(node.layerId))
      throw new Error(`经脉${node.layerId}层只能选择一个节点`);
    occupiedLayers.add(node.layerId);
    if (!unlockedLayers.has(node.layerId))
      throw new Error(`${node.name}所属层级尚未解锁`);
    for (const [methodId, level] of Object.entries(
      node.requiredMethods ?? {},
    )) {
      if ((args.methods[methodId] ?? 0) < level)
        throw new Error(`${node.name}尚未达到心法要求`);
    }
  }
  return uniqueIds;
}

export function assertMethodTrainingTarget(args: {
  definition: SectDefinition;
  methodId: SectMethodId;
  currentLevel: number;
  targetLevel: number;
  levelCap: number;
  methods: Partial<Record<SectMethodId, number>>;
}) {
  const method = args.definition.methods.find(
    (entry) => entry.id === args.methodId,
  );
  if (!method) throw new Error('未知宗门心法');
  if (
    !Number.isInteger(args.targetLevel) ||
    args.targetLevel <= args.currentLevel
  ) {
    throw new Error('目标心法等级必须高于当前等级');
  }
  if (args.targetLevel > args.levelCap)
    throw new Error('心法等级超过当前境界上限');
  const primary = args.definition.methods.find((entry) => entry.isPrimary);
  if (
    primary &&
    method.id !== primary.id &&
    args.targetLevel > (args.methods[primary.id] ?? 0)
  ) {
    throw new Error(`分卷等级不得超过${primary.name}`);
  }
}
