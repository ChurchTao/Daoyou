import { compileLingxiaoSwift } from './combatProjection';
import { createSectNodeContribution } from './compiler';
import { SWIFT_NODES, SWIFT_SWORD_PATH } from './lingxiao';
import { LingxiaoSwiftSelectionStrategy } from './selectionStrategy';
import type { SectNodeBehavior, SectPathModule } from './types';

function behavior(nodeId: string): SectNodeBehavior {
  return {
    contribute(context, build) {
      if (!context.activeNodeIds.has(nodeId)) throw new Error(`节点 ${nodeId} 未进入编译上下文`);
      return createSectNodeContribution(build, compileLingxiaoSwift(context, context.path, context.activeNodeIds));
    },
  };
}

export const LINGXIAO_SWIFT_PATH_MODULE: SectPathModule = {
  definition: SWIFT_SWORD_PATH,
  compileVariants(context) {
    return compileLingxiaoSwift(context, context.path, new Set());
  },
  nodeBehaviors: Object.fromEntries(SWIFT_NODES.map((node) => [node.id, behavior(node.id)])),
  createSelectionStrategy: (tacticId) => new LingxiaoSwiftSelectionStrategy(tacticId),
};
