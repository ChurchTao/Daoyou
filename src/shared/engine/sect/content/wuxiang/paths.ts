import {
  BaseSectPathModule,
  STANDARD_PATH_LAYERS,
  type SectBuildBuilder,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectTacticId,
} from '../../core';
import { compileWuxiangPath } from './shared/compiler';
import { WUXIANG_DEMON_PATH_ID, WUXIANG_MIRROR_PATH_ID } from './ids';
import { WUXIANG_DEMON_NODES } from './paths/demon/nodes';
import { WUXIANG_MIRROR_NODES } from './paths/mirror/nodes';
import {
  createWuxiangBuildSettings,
  DEMON_BUILD_FACADE,
  DemonBuildFacade,
  MIRROR_BUILD_FACADE,
  MirrorBuildFacade,
} from './shared/buildFacades';
import {
  WuxiangDemonSelectionStrategy,
  WuxiangMirrorSelectionStrategy,
} from './strategy';

const mirrorDefinition: SectPathDefinitionWithoutNodes = {
  id: WUXIANG_MIRROR_PATH_ID,
  name: '明镜照业',
  description:
    '以承受制造因，以魔相兑现果。来力不急于拒绝，只把每一道因果留在镜中；佛相立因，魔相现报，无相令因果同时照见。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'guard',
  tactics: [
    {
      id: 'guard',
      name: '守镜',
      description:
        '优先保持3层业痕与防守状态；达到5点心念后入魔，优先使用防御神通维持血线。',
    },
    {
      id: 'present',
      name: '现报',
      description:
        '至少1层业痕且达到3点心念便入魔，优先使用可即时消费业痕的攻击神通。',
    },
    {
      id: 'formless',
      name: '无相',
      description:
        '原则上积满6点心念再显无相；低于35%气血且已有3点心念时允许提前入魔自救。',
    },
  ],
  presentation: {
    highlights: [
      {
        name: '受击留业',
        description: '佛相承受敌方直接伤害，积累业痕并即时返还部分来力。',
      },
      {
        name: '逐层现报',
        description:
          '佛相奠定招式根基；显化魔相时照见现报，显化无相时再现最终变化。',
      },
      {
        name: '一念两照',
        description:
          '显化无相时，同一门神通会兼具佛相本式、魔相变化与无相变化。',
      },
    ],
    abilityChanges: {
      'flower-heart':
        '佛相伤敌并留下叩心戒；魔相借业痕问罪追击、封住敌招；无相再发一击，并为自身留下业痕。',
      'blood-tide':
        '佛相提供护盾与听潮减伤；魔相消费业痕恢复并登记受击反击；无相额外加厚护盾。',
      'three-knocks':
        '佛相三击并留下新的业门；魔相借业痕引爆目标原有的业门；无相在旧门尽空后再发一击。',
      'observe-calamity':
        '佛相架势抵御一次直接伤害；魔相消费业痕令减伤同时反击；无相将架势扩展为两次。',
      'five-skandhas':
        '佛相伤敌并驱散敌方增益；魔相借业痕净化自身；无相额外伤敌并获得护盾。',
      'reed-crossing':
        '佛相保护下一次直接受击；魔相消费业痕令防护触发时反击；无相额外获得护盾。',
      'turn-form':
        '3～5点心念可使之后两门神通显化魔相；6点心念可使下一门神通显化无相。',
    },
  },
};

const demonDefinition: SectPathDefinitionWithoutNodes = {
  id: WUXIANG_DEMON_PATH_ID,
  name: '魔心渡厄',
  description:
    '以佛相主动沉血，以魔相强渡两息，以无相令燃血与渡厄同时显化。气血不是怒气的别名，而是每一门神通真正支付的渡河之资。',
  minRealm: '筑基',
  minRealmStage: '初期',
  layers: [...STANDARD_PATH_LAYERS],
  defaultTacticId: 'trial-fire',
  tactics: [
    {
      id: 'trial-fire',
      name: '试火',
      description:
        '达到3点心念且低于60%气血时入魔，优先防御神通与吸血窗口，避免继续无保护沉血。',
    },
    {
      id: 'sink-boat',
      name: '沉舟',
      description:
        '尽量积至5点心念并主动压至45%气血以下，入魔后优先连续使用攻击神通收束。',
    },
    {
      id: 'one-thought',
      name: '一念',
      description:
        '优先积满6点心念使用无相；低于25%气血时允许以3点心念提前入魔自救。',
    },
  ],
  presentation: {
    highlights: [
      {
        name: '主动沉血',
        description: '佛相支付当前气血施展神通，以真实代价换取心念。',
      },
      {
        name: '两息渡厄',
        description:
          '进入魔相后，接下来两门宗门神通都会显现各自的魔相变化，并共享减伤、免控与吸血之效。',
      },
      {
        name: '佛魔同炉',
        description:
          '显化无相时，同一门神通会兼具佛相本式、魔相变化与无相变化。',
      },
    ],
    abilityChanges: {
      'flower-heart':
        '佛相伤敌并留下心隙；魔相再发摘心重击并多留一层心隙；无相根据目标已损气血收束。',
      'blood-tide':
        '佛相重血换取护盾与下一击强化；魔相加厚护盾并令血潮命中回血；无相立即回生并强化血潮。',
      'three-knocks':
        '佛相三击，并在自身气血较低时强化末击；魔相再发一记重击；无相在濒危时发动必定暴击的无生之击。',
      'observe-calamity':
        '佛相降低下一次直接伤害；魔相令承劫后反击；无相再获得护盾。',
      'five-skandhas':
        '佛相净化并在成功时获得心念；魔相获得护盾与下一击强化；无相再净化一个减益。',
      'reed-crossing':
        '佛相获得护盾与下一击减伤；魔相进一步强化两者；无相在濒危时恢复气血。',
      'turn-form':
        '3～5点心念可进入魔相两式并获得渡厄护体；6点心念可使下一门神通显化无相。',
    },
  },
};

class MirrorPathModule extends BaseSectPathModule {
  constructor() {
    super(mirrorDefinition, WUXIANG_MIRROR_NODES);
  }
  protected initializeBuild(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    builder.setExtension(
      MIRROR_BUILD_FACADE,
      new MirrorBuildFacade(createWuxiangBuildSettings()),
    );
  }
  protected finalizeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    const facade = builder.requireExtension<MirrorBuildFacade>(
      MIRROR_BUILD_FACADE,
      '明镜照业构筑',
    );
    compileWuxiangPath(builder, context.path.pathId, facade.settings);
  }
  createSelectionStrategy(tacticId: SectTacticId) {
    return new WuxiangMirrorSelectionStrategy(tacticId);
  }
}

class DemonPathModule extends BaseSectPathModule {
  constructor() {
    super(demonDefinition, WUXIANG_DEMON_NODES);
  }
  protected initializeBuild(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    builder.setExtension(
      DEMON_BUILD_FACADE,
      new DemonBuildFacade(createWuxiangBuildSettings()),
    );
  }
  protected finalizeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    const facade = builder.requireExtension<DemonBuildFacade>(
      DEMON_BUILD_FACADE,
      '魔心渡厄构筑',
    );
    compileWuxiangPath(builder, context.path.pathId, facade.settings);
  }
  createSelectionStrategy(tacticId: SectTacticId) {
    return new WuxiangDemonSelectionStrategy(tacticId);
  }
}

export const WUXIANG_MIRROR_PATH_MODULE = new MirrorPathModule();
export const WUXIANG_DEMON_PATH_MODULE = new DemonPathModule();
