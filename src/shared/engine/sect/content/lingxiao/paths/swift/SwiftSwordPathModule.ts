import {
  BaseSectPathModule,
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
  description: '抢先积势、连锋留痕、择机收束。',
  levelBenefitDescription: '每级提高快剑变体伤害、反击与护盾倍率0.08%。',
  defaultTacticId: 'aggressive',
  tactics: [
    {
      id: 'aggressive',
      name: '急攻',
      description: '三势即收，优先追击低血目标。',
    },
    {
      id: 'steady',
      name: '稳势',
      description: '尽量蓄满六势，再以完整倍率收束。',
    },
    {
      id: 'counter',
      name: '回风',
      description: '优先回燕与剑罡，五势以上再收束。',
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
