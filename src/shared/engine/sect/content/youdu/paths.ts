import {
  BaseSectPathModule,
  STANDARD_PATH_LAYERS,
  type SectBuildBuilder,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectTacticId,
} from '../../core';
import { compileYouduBuild } from './base/YouduBaseCompiler';
import { YOUDU_DECREE_PATH_ID, YOUDU_TIDE_PATH_ID } from './ids';
import { YOUDU_DECREE_NODES } from './paths/decree/nodes';
import { YOUDU_TIDE_NODES } from './paths/tide/nodes';
import {
  DECREE_BUILD_FACADE,
  DecreeBuildFacade,
  TIDE_BUILD_FACADE,
  TideBuildFacade,
  createYouduBuildSettings,
} from './shared/buildFacade';
import { YouduDecreeSelectionStrategy, YouduTideSelectionStrategy } from './strategy';

const tideDefinition: SectPathDefinitionWithoutNodes = {
  id: YOUDU_TIDE_PATH_ID,
  name: '招魂渡夜',
  description: '一声唤名落入黑水，千里游魂都听见自己的回音。此道让忘川一寸寸漫过归路。',
  minRealm: '筑基', minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'tide-cycle',
  tactics: [
    { id: 'tide-cycle', name: '回潮', description: '优先补忘川并维持三层蚀魂，在终结线兑现。' },
    { id: 'healer-drown', name: '沉医', description: '维持忘川压疗，在高层窗口优先镇魂。' },
    { id: 'long-night', name: '长夜', description: '延后终结，维持四层压力，魂火满或低血时再兑现。' },
  ],
  presentation: {
    highlights: [
      { name: '长夜回潮', description: '忘川对深度蚀魂目标造成更多魂伤。' },
      { name: '药石难入', description: '以忘川与蚀魂叠加压缩治疗窗口。' },
      { name: '余烬不散', description: '终结之后仍可保留下一轮铺垫。' },
    ],
    abilityChanges: {
      'forgetful-river-tide': '忘川在至少3层蚀魂目标上提高20%持续魂伤，并能从每回合首次有效潮伤中获得魂火。',
      'soul-shall-not-return': '节点可强化逐层魂伤、保留蚀魂或在终结后续接忘川。',
    },
  },
};

const decreeDefinition: SectPathDefinitionWithoutNodes = {
  id: YOUDU_DECREE_PATH_ID,
  name: '镇魄司命',
  description: '见影而知魂，知魂而书名；铁钉落下之前，门人已量过每一道离身缝隙。',
  minRealm: '筑基', minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'pin-the-caster',
  tactics: [
    { id: 'pin-the-caster', name: '钉法者', description: '优先照影并压制敌方术者，在关键窗口镇魂。' },
    { id: 'judge-at-four', name: '四层判决', description: '集中单一目标，达到四层立即终结。' },
    { id: 'take-the-fifth', name: '取其第五', description: '优先触发失魂，再在归窍窗口储存魂火。' },
  ],
  presentation: {
    highlights: [
      { name: '司命断章', description: '直接魂伤在高层目标上更强。' },
      { name: '见影知名', description: '照影将层数进一步化为自身魂伤。' },
      { name: '镇魄裁断', description: '在四层抉择控制、失魂或终结。' },
    ],
    abilityChanges: {
      'reveal-shadow': '自身对照影目标造成魂伤时，每层蚀魂额外提高1%。',
      'pin-soul': '节点可强化高层镇魂的命中、速度压制与法力效率。',
      'soul-shall-not-return': '节点可强化基础与逐层魂伤，并提供裁决后的资源回转。',
    },
  },
};

class TidePathModule extends BaseSectPathModule {
  constructor() { super(tideDefinition, YOUDU_TIDE_NODES); }
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void {
    builder.setExtension(TIDE_BUILD_FACADE, new TideBuildFacade(createYouduBuildSettings(YOUDU_TIDE_PATH_ID)));
  }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void {
    const facade = builder.requireExtension<TideBuildFacade>(TIDE_BUILD_FACADE, '招魂渡夜构筑');
    compileYouduBuild(context, builder, facade.settings);
  }
  createSelectionStrategy(tacticId: SectTacticId) { return new YouduTideSelectionStrategy(tacticId); }
}

class DecreePathModule extends BaseSectPathModule {
  constructor() { super(decreeDefinition, YOUDU_DECREE_NODES); }
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void {
    builder.setExtension(DECREE_BUILD_FACADE, new DecreeBuildFacade(createYouduBuildSettings(YOUDU_DECREE_PATH_ID)));
  }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void {
    const facade = builder.requireExtension<DecreeBuildFacade>(DECREE_BUILD_FACADE, '镇魄司命构筑');
    compileYouduBuild(context, builder, facade.settings);
  }
  createSelectionStrategy(tacticId: SectTacticId) { return new YouduDecreeSelectionStrategy(tacticId); }
}

export const YOUDU_TIDE_PATH_MODULE = new TidePathModule();
export const YOUDU_DECREE_PATH_MODULE = new DecreePathModule();
