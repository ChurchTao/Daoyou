import { compileLingxiaoHeavy } from './combatProjection';
import { createSectNodeContribution } from './compiler';
import { HEAVY_NODES, HEAVY_SWORD_PATH } from './lingxiao';
import { LingxiaoHeavySelectionStrategy } from './selectionStrategy';
import type { SectNodeBehavior, SectPathModule } from './types';

function behavior(nodeId: string): SectNodeBehavior {
  return {
    contribute(context, build) {
      if (!context.activeNodeIds.has(nodeId)) throw new Error(`节点 ${nodeId} 未进入编译上下文`);
      return createSectNodeContribution(build, compileLingxiaoHeavy(context, context.path, context.activeNodeIds));
    },
  };
}

export const LINGXIAO_HEAVY_PATH_MODULE: SectPathModule = {
  definition: HEAVY_SWORD_PATH,
  compileVariants(context) {
    return compileLingxiaoHeavy(context, context.path, new Set());
  },
  nodeBehaviors: Object.fromEntries(HEAVY_NODES.map((node) => [node.id, behavior(node.id)])),
  createSelectionStrategy: (tacticId) => new LingxiaoHeavySelectionStrategy(tacticId),
};
