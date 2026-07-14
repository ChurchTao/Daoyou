import {
  BaseSectPathModule,
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
  description: '以架承势、裂甲压阵、聚力破岳。',
  levelBenefitDescription: '每级提高重剑变体伤害、反击与护盾倍率0.08%。',
  defaultTacticId: 'heavy-break',
  tactics: [
    {
      id: 'heavy-break',
      name: '破阵',
      description: '三架即收，优先叠甲与斩杀。',
    },
    {
      id: 'heavy-full',
      name: '镇岳',
      description: '蓄满六架，以开天断岳破敌。',
    },
    {
      id: 'heavy-guard',
      name: '守关',
      description: '优先横剑与剑罡，五架以上再收束。',
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
