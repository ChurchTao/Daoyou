import { projectLingxiaoCombat, resolveLingxiaoAbility } from './combatProjection';
import { HEAVY_NODES, HEAVY_SWORD_PATH, LINGXIAO_SECT, SWIFT_NODES, SWIFT_SWORD_PATH } from './lingxiao';
import { LingxiaoHeavySelectionStrategy, LingxiaoSwiftSelectionStrategy } from './selectionStrategy';
import type { SectModule } from './types';

export const LINGXIAO_MODULE: SectModule = {
  definition: LINGXIAO_SECT,
  paths: {
    [SWIFT_SWORD_PATH.id]: {
      definition: SWIFT_SWORD_PATH,
      behaviorIds: SWIFT_NODES.map((node) => node.id),
      projectCombat: projectLingxiaoCombat,
      resolveAbility: resolveLingxiaoAbility,
      createSelectionStrategy: (tacticId) => new LingxiaoSwiftSelectionStrategy(tacticId),
    },
    [HEAVY_SWORD_PATH.id]: {
      definition: HEAVY_SWORD_PATH,
      behaviorIds: HEAVY_NODES.map((node) => node.id),
      projectCombat: projectLingxiaoCombat,
      resolveAbility: resolveLingxiaoAbility,
      createSelectionStrategy: (tacticId) => new LingxiaoHeavySelectionStrategy(tacticId),
    },
  },
  trial: {
    methods: { 'lingxiao-canon': 10, 'sword-guidance': 10 },
    abilityLoadout: ['guiding-sword', 'linked-edge', null, null],
    opponentName: '凌霄试剑木人',
  },
  projectCombat(context) {
    const path = context.sect.paths.find((entry) => entry.pathId === context.sect.activePathId);
    const pathModule = path ? this.paths[path.pathId] : undefined;
    const projection = pathModule?.projectCombat(context) ?? projectLingxiaoCombat(context);
    if (!projection) return null;
    if (path && pathModule) {
      projection.selectionStrategy = pathModule.createSelectionStrategy(path.tacticId);
    }
    return projection;
  },
  resolveAbility(context) {
    const path = context.sect.paths.find((entry) => entry.pathId === context.sect.activePathId);
    return (path ? this.paths[path.pathId]?.resolveAbility(context) : undefined)
      ?? resolveLingxiaoAbility(context);
  },
};
