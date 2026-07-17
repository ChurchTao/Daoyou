import {
  BaseSectPathModule,
  STANDARD_PATH_LAYERS,
  type SectBuildBuilder,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectTacticId,
} from '../../../../core';
import { SWIFT_SWORD_PATH_ID } from '../../ids';
import { SWIFT_SWORD_NODES } from './nodes';
import { LingxiaoSwiftSelectionStrategy } from './strategy';
import { initializeSwiftSwordBuild } from './SwiftSwordBuildFacade';

const SWIFT_SWORD_DEFINITION: SectPathDefinitionWithoutNodes = {
  id: SWIFT_SWORD_PATH_ID,
  name: '快剑道',
  description: '剑随身走，势借风生；以连绵锋芒留下剑痕，于转瞬之间决胜。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'aggressive',
  tactics: [
    {
      id: 'aggressive',
      name: '追风',
      description: '剑势达到3点即可施展《剑破万法》，优先追击气血较低的目标。',
    },
    {
      id: 'steady',
      name: '连势',
      description: '尽量积蓄6点剑势，再以完整威力施展《剑破万法》。',
    },
    {
      id: 'counter',
      name: '回燕',
      description: '优先施展《藏锋听雷》与《剑心通明》，剑势达到5点后再行收束。',
    },
  ],
};

export class SwiftSwordPathModule extends BaseSectPathModule {
  constructor() {
    super(SWIFT_SWORD_DEFINITION, SWIFT_SWORD_NODES);
  }

  compileVariants(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    initializeSwiftSwordBuild(context, builder);
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new LingxiaoSwiftSelectionStrategy(tacticId);
  }
}

export const LINGXIAO_SWIFT_PATH_MODULE = new SwiftSwordPathModule();
export const SWIFT_SWORD_PATH = LINGXIAO_SWIFT_PATH_MODULE.definition;
export const SWIFT_NODES = SWIFT_SWORD_PATH.nodes;
