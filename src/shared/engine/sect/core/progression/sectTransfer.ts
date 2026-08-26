import {
  StandardSectRules,
  type CultivatorSectPathState,
  type CultivatorSectState,
  type SectDefinition,
} from '../domain';

export interface SectTransferPathMapping {
  sourcePathId: string;
  targetPathId: string;
  unlockedLayerCount: number;
}

export interface SectTransferPlan {
  sourceSectId: string;
  targetSectId: string;
  methodLevels: Array<{
    sourceMethodId: string;
    sourceMethodName: string;
    targetMethodId: string;
    targetMethodName: string;
    level: number;
  }>;
  pathMappings: SectTransferPathMapping[];
  targetPaths: CultivatorSectPathState[];
  activePathId?: string;
}

/**
 * 将标准宗门的已投入进度换算为目标宗门进度。
 * 心法按固定槽位迁移；流派只迁移已付费解锁的层数，节点与战术重新选择。
 */
export function buildSectTransferPlan(args: {
  source: CultivatorSectState;
  sourceDefinition: SectDefinition;
  targetDefinition: SectDefinition;
  reversePathMapping?: boolean;
}): SectTransferPlan {
  const { source, sourceDefinition, targetDefinition } = args;
  if (source.sectId !== sourceDefinition.id)
    throw new Error('欺天符源玉牒与宗门定义不一致');
  if (sourceDefinition.id === targetDefinition.id)
    throw new Error('不能以欺天符改写为当前宗门');
  if (
    sourceDefinition.methods.length !== 6 ||
    targetDefinition.methods.length !== 6
  )
    throw new Error('欺天符仅支持六本标准心法的宗门');
  if (
    sourceDefinition.paths.length !== 2 ||
    targetDefinition.paths.length !== 2
  )
    throw new Error('欺天符仅支持双道途标准宗门');

  const sourceMethods = [...sourceDefinition.methods].sort(
    (left, right) => left.slot - right.slot,
  );
  const targetMethods = [...targetDefinition.methods].sort(
    (left, right) => left.slot - right.slot,
  );
  const methodLevels = sourceMethods.map((method, index) => ({
    sourceMethodId: method.id,
    sourceMethodName: method.name,
    targetMethodId: targetMethods[index]!.id,
    targetMethodName: targetMethods[index]!.name,
    level: source.methods[method.id] ?? 0,
  }));

  const sourcePaths = sourceDefinition.paths;
  const targetPaths = args.reversePathMapping
    ? [...targetDefinition.paths].reverse()
    : targetDefinition.paths;
  const pathMappings = sourcePaths.map((sourcePath, index) => {
    const progress = source.paths.find(
      (entry) => entry.pathId === sourcePath.id,
    );
    return {
      sourcePathId: sourcePath.id,
      targetPathId: targetPaths[index]!.id,
      unlockedLayerCount: progress?.unlockedLayerIds.length ?? 0,
    };
  });
  const migratedPaths = pathMappings
    .filter((mapping) => mapping.unlockedLayerCount > 0)
    .map((mapping): CultivatorSectPathState => {
      const definition = targetDefinition.paths.find(
        (path) => path.id === mapping.targetPathId,
      )!;
      return {
        pathId: definition.id,
        unlockedLayerIds: [...definition.layers]
          .sort((left, right) => left.order - right.order)
          .slice(0, mapping.unlockedLayerCount)
          .map((layer) => layer.id),
        tacticId: definition.defaultTacticId,
        activeMeridianSlot: 1,
        meridianLoadouts: StandardSectRules.meridianLoadoutSlots.map(
          (slot) => ({ slot, nodeIds: [], version: 1 }),
        ),
      };
    });
  const activePathId = source.activePathId
    ? pathMappings.find(
        (mapping) => mapping.sourcePathId === source.activePathId,
      )?.targetPathId
    : migratedPaths[0]?.pathId;

  return {
    sourceSectId: sourceDefinition.id,
    targetSectId: targetDefinition.id,
    methodLevels,
    pathMappings,
    targetPaths: migratedPaths,
    ...(activePathId &&
    migratedPaths.some((path) => path.pathId === activePathId)
      ? { activePathId }
      : {}),
  };
}
