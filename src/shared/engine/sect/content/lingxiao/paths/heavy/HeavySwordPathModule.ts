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
  description: '护盾承伤、藏锋后发、守中反击，以不工之剑开山。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'heavy-break',
  tactics: [
    {
      id: 'heavy-break',
      name: '后发',
      description: '优先不动藏锋，围绕承伤与反击积蓄剑势。',
    },
    {
      id: 'heavy-full',
      name: '开天',
      description: '优先积满六势，以开天一线完成单段爆发。',
    },
    {
      id: 'heavy-guard',
      name: '守山',
      description: '优先镇岳步与山河守心，五势以上收束。',
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
