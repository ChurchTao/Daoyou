import {
  BaseSectPathModule,
  STANDARD_PATH_LAYERS,
  type SectBuildBuilder,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectTacticId,
} from '../../core';
import {
  TIANYAN_HETU_PATH_ID,
  TIANYAN_LUOSHU_PATH_ID,
} from './ids';
import { compileHetuBuild } from './paths/hetu/compiler';
import { TIANYAN_HETU_NODES } from './paths/hetu/nodes';
import { compileLuoshuBuild } from './paths/luoshu/compiler';
import { TIANYAN_LUOSHU_NODES } from './paths/luoshu/nodes';
import {
  HETU_BUILD_FACADE,
  HetuBuildFacade,
  LUOSHU_BUILD_FACADE,
  LuoshuBuildFacade,
  createTianyanBuildSettings,
} from './shared/buildFacades';
import { HetuSelectionStrategy, LuoshuSelectionStrategy } from './strategy';

const hetuDefinition: SectPathDefinitionWithoutNodes = {
  id: TIANYAN_HETU_PATH_ID,
  name: '河图演生',
  description:
    '河图示其流，前法不灭，后法由此而生。三数成图之后，伤势、气血与法力都在同一轮转中得到续接。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'small-cycle',
  tactics: [
    { id: 'small-cycle', name: '小周天', description: '优先选择能够继续反应的落印术，以三行闭环维持周天。' },
    { id: 'nourish-origin', name: '养元', description: '血线或法力不足时优先内景法，其余时间维持反应。' },
    { id: 'unbroken-flow', name: '不绝', description: '有印而无可用反应时优先移宫，否则以太初玄光保留法印。' },
  ],
  presentation: {
    highlights: [
      { name: '三数成图', description: '每三次反应形成一次小周天，同时补充输出与资源。' },
      { name: '内外相养', description: '治疗、壁垒和秘法能够进入反应构筑。' },
      { name: '留白不断', description: '太初玄光可以等待时机而不破坏法印。' },
    ],
    abilityChanges: {
      'tianyan-runtime': '第三次反应触发河图周天，强化主伤害并回复气血与法力。',
    },
  },
};

const luoshuDefinition: SectPathDefinitionWithoutNodes = {
  id: TIANYAN_LUOSHU_PATH_ID,
  name: '洛书制化',
  description:
    '洛书定其位，不等万法自然流转。移一宫、断一势、藏一印，在敌势真正成形之前先改写它的去处。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'break-pattern',
  tactics: [
    { id: 'break-pattern', name: '破阵', description: '优先触发冲克并利用太白破阵驱散敌方增益。' },
    { id: 'lock-meridian', name: '锁机', description: '优先准备并触发断脉或泥沼，压缩敌方行动。' },
    { id: 'decisive-derivation', name: '断局', description: '优先预期直接伤害最高的反应，必要时移宫或归藏。' },
  ],
  presentation: {
    highlights: [
      { name: '移宫改局', description: '主动转换法印，准备关键冲克。' },
      { name: '制化断势', description: '破防、禁法、定身与削攻共同压缩敌方选择。' },
      { name: '三数决胜', description: '每三次反应获得一次稳定的无属性爆发。' },
    ],
    abilityChanges: {
      'tianyan-runtime': '第三次反应触发洛书断局，追加无属性伤害并强化属性削弱。',
    },
  },
};

class HetuPathModule extends BaseSectPathModule {
  constructor() { super(hetuDefinition, TIANYAN_HETU_NODES); }

  protected initializeBuild(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    builder.setExtension(
      HETU_BUILD_FACADE,
      new HetuBuildFacade(createTianyanBuildSettings(TIANYAN_HETU_PATH_ID)),
    );
  }

  protected finalizeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    const facade = builder.requireExtension<HetuBuildFacade>(
      HETU_BUILD_FACADE,
      '河图演生构筑',
    );
    compileHetuBuild(context, builder, facade.settings);
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new HetuSelectionStrategy(tacticId);
  }
}

class LuoshuPathModule extends BaseSectPathModule {
  constructor() { super(luoshuDefinition, TIANYAN_LUOSHU_NODES); }

  protected initializeBuild(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    builder.setExtension(
      LUOSHU_BUILD_FACADE,
      new LuoshuBuildFacade(createTianyanBuildSettings(TIANYAN_LUOSHU_PATH_ID)),
    );
  }

  protected finalizeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    const facade = builder.requireExtension<LuoshuBuildFacade>(
      LUOSHU_BUILD_FACADE,
      '洛书制化构筑',
    );
    compileLuoshuBuild(context, builder, facade.settings);
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new LuoshuSelectionStrategy(tacticId);
  }
}

export const TIANYAN_HETU_PATH_MODULE = new HetuPathModule();
export const TIANYAN_LUOSHU_PATH_MODULE = new LuoshuPathModule();
