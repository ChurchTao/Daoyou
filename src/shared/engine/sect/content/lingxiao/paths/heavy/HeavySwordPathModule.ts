import {
  BaseSectPathModule,
  STANDARD_PATH_LAYERS,
  type SectBuildBuilder,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectTacticId,
} from '../../../../core';
import { HEAVY_SWORD_PATH_ID } from '../../ids';
import { initializeHeavySwordBuild } from './HeavySwordBuildFacade';
import { HEAVY_SWORD_NODES } from './nodes';
import { LingxiaoHeavySelectionStrategy } from './strategy';

const HEAVY_SWORD_DEFINITION: SectPathDefinitionWithoutNodes = {
  id: HEAVY_SWORD_PATH_ID,
  name: '重剑道',
  description: '以身立地，以剑镇岳；借护盾承势，于守中后发，一剑开山。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'heavy-break',
  tactics: [
    {
      id: 'heavy-break',
      name: '后发',
      description: '优先施展《藏锋听雷》，围绕受到伤害与反击积蓄剑势，达到3点后即可收束。',
    },
    {
      id: 'heavy-full',
      name: '极势',
      description: '优先积蓄6点剑势，以《剑破万法》完成全力一击。',
    },
    {
      id: 'heavy-guard',
      name: '守山',
      description: '优先建立护盾并施展《剑心通明》，剑势达到5点后再行收束。',
    },
  ],
};

export class HeavySwordPathModule extends BaseSectPathModule {
  constructor() {
    super(HEAVY_SWORD_DEFINITION, HEAVY_SWORD_NODES);
  }

  compileVariants(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    initializeHeavySwordBuild(context, builder);
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new LingxiaoHeavySelectionStrategy(tacticId);
  }
}

export const LINGXIAO_HEAVY_PATH_MODULE = new HeavySwordPathModule();
export const HEAVY_SWORD_PATH = LINGXIAO_HEAVY_PATH_MODULE.definition;
export const HEAVY_NODES = HEAVY_SWORD_PATH.nodes;
