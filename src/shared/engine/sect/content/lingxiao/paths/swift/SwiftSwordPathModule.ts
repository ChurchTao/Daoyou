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
import { initializeSwiftSwordBuild, swiftSwordBuild } from './SwiftSwordBuildFacade';

const SWIFT_SWORD_DEFINITION: SectPathDefinitionWithoutNodes = {
  id: SWIFT_SWORD_PATH_ID,
  name: '疾风骤雨',
  description:
    '剑随疾风而起，锋如骤雨倾落；一痕未消，一痕又生，于连绵不绝之间决胜。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'aggressive',
  presentation: {
    highlights: [
      { name: '连击留痕', description: '以高频连击施加剑痕。' },
      { name: '身法借势', description: '以身法与闪避换取进攻节奏。' },
      { name: '多段收束', description: '将剑势转化为连续斩击。' },
    ],
    abilityChanges: {
      'plain-sword': '牺牲少量基础威力，维持稳定积势。',
      'sect-ultimate': '由单段爆发改为随剑势追加斩击的多段收束。',
      'guiding-sword': '身法高于目标时追加追击，强化抢攻能力。',
      'linked-edge': '改为五段连击，获得更多剑势并施加剑痕，不再进入调息。',
      'turning-body': '改为先攻后守；短暂提高闪避，首次闪避时反击并积势。',
      'shadow-step': '进一步提高身法与闪避，首次闪避时额外积势。',
      'breaking-edge': '维持基础威力与驱散能力。',
      'sword-aegis': '降低部分法术防御，改以额外闪避替代控制抗性。',
      'nurturing-sword': '降低部分物攻增幅，同时提高身法。',
    },
  },
  tactics: [
    {
      id: 'aggressive',
      name: '追风',
      description: '剑势达到3点即可施展《剑破万法》，优先追击气血较低的目标。',
    },
    {
      id: 'steady',
      name: '连势',
      description: '剑痕不足2层时优先补痕，达到6点剑势且剑痕充足后收束。',
    },
    {
      id: 'counter',
      name: '回燕',
      description:
        '优先补《藏锋听雷》；身法不占优且《踏雪无痕》缺失时，先踏雪再施展《剑荡山河》；剑势达到5点后收束。',
    },
  ],
};

export class SwiftSwordPathModule extends BaseSectPathModule {
  constructor() {
    super(SWIFT_SWORD_DEFINITION, SWIFT_SWORD_NODES);
  }

  protected initializeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    initializeSwiftSwordBuild(context, builder);
  }

  protected finalizeBuild(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    swiftSwordBuild(builder).finalize();
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new LingxiaoSwiftSelectionStrategy(tacticId);
  }
}

export const LINGXIAO_SWIFT_PATH_MODULE = new SwiftSwordPathModule();
export const SWIFT_SWORD_PATH = LINGXIAO_SWIFT_PATH_MODULE.definition;
