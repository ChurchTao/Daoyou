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
import { WuxiangDemonSelectionStrategy, WuxiangMirrorSelectionStrategy } from './strategy';

const mirrorDefinition: SectPathDefinitionWithoutNodes = {
  id: WUXIANG_MIRROR_PATH_ID,
  name: '明镜照业',
  description: '以承受制造因，以魔相兑现果。来力不急于拒绝，只把每一道因果留在镜中；佛相立因，魔相现报，无相令因果同时照见。',
  minRealm: '筑基', minRealmStage: '初期', layers: [...STANDARD_PATH_LAYERS], defaultTacticId: 'guard',
  tactics: [
    { id: 'guard', name: '守镜', description: '优先保持3层业痕与防守状态；达到5点战意后入魔，优先使用防御神通维持血线。' },
    { id: 'present', name: '现报', description: '至少1层业痕且达到3点战意便入魔，优先使用可即时消费业痕的攻击神通。' },
    { id: 'formless', name: '无相', description: '原则上积满6点战意再显无相；低于35%气血且已有3点战意时允许提前入魔自救。' },
  ],
  presentation: {
    highlights: [
      { name: '受击留业', description: '佛相承受敌方直接伤害，积累业痕并即时返还部分来力。' },
      { name: '逐层现报', description: '每门神通保留佛相主体，魔相追加该技能专属现报，无相再追加最终变化。' },
      { name: '一念两照', description: '无相不是替换技能，而是让同一门神通的佛、魔、无相三层同时结算。' },
    ],
    abilityChanges: {
      'flower-heart': '佛相立下叩心戒；魔相消费业痕追加问罪与封招；无相再添一击并重新留下业痕。',
      'blood-tide': '佛相提供护盾与听潮减伤；魔相消费业痕恢复并登记受击反击；无相额外加厚护盾。',
      'three-knocks': '佛相三击并在结算末尾留下新业门；魔相消费业痕并引爆此前的旧业门；无相再追加一记无相之击。',
      'observe-calamity': '佛相架势抵御一次直接伤害；魔相消费业痕令减伤同时反击；无相将架势扩展为两次。',
      'five-skandhas': '佛相伤害并驱散敌方增益；魔相消费业痕净化自身；无相追加伤害与护盾。',
      'reed-crossing': '佛相保护下一次直接受击；魔相消费业痕令防护触发时反击；无相额外获得护盾。',
      'turn-form': '3～5战意令之后两门神通结算A+B；6战意令下一门神通结算A+B+C。',
    },
  },
};

const demonDefinition: SectPathDefinitionWithoutNodes = {
  id: WUXIANG_DEMON_PATH_ID,
  name: '魔心渡厄',
  description: '以佛相主动沉血，以魔相强渡两息，以无相令燃血与渡厄同时显化。气血不是怒气的别名，而是每一门神通真正支付的渡河之资。',
  minRealm: '筑基', minRealmStage: '初期', layers: [...STANDARD_PATH_LAYERS], defaultTacticId: 'trial-fire',
  tactics: [
    { id: 'trial-fire', name: '试火', description: '达到3点战意且低于60%气血时入魔，优先防御神通与吸血窗口，避免继续无保护沉血。' },
    { id: 'sink-boat', name: '沉舟', description: '尽量积至5点战意并主动压至45%气血以下，入魔后优先连续使用攻击神通收束。' },
    { id: 'one-thought', name: '一念', description: '优先积满6点战意使用无相；低于25%气血时允许以3点战意提前入魔自救。' },
  ],
  presentation: {
    highlights: [
      { name: '主动沉血', description: '佛相支付当前气血施展神通，以真实代价换取战意。' },
      { name: '两息渡厄', description: '魔相连续两门神通均在佛相主体上追加各自B层，并共享减伤、免控和吸血窗口。' },
      { name: '佛魔同炉', description: '无相令同一技能的A、B、C三层一次结算，而不是重新生成另一门技能。' },
    ],
    abilityChanges: {
      'flower-heart': '佛相伤敌并留下心隙；魔相追加摘心一击与第二层心隙；无相按目标已损气血收束。',
      'blood-tide': '佛相重血换取护盾与下一击强化；魔相加厚护盾并令血潮命中回血；无相立即回生并强化血潮。',
      'three-knocks': '佛相三击并在低血强化第三击；魔相追加第四击；无相在濒危时追加必定暴击的无生一击。',
      'observe-calamity': '佛相降低下一次直接伤害；魔相令承劫后反击；无相再获得护盾。',
      'five-skandhas': '佛相净化并在成功时获得战意；魔相获得护盾与下一击强化；无相再净化一个减益。',
      'reed-crossing': '佛相获得护盾与下一击减伤；魔相进一步强化两者；无相在濒危时恢复气血。',
      'turn-form': '3～5战意令之后两门神通结算A+B并获得渡厄护体；6战意令下一门神通结算A+B+C。',
    },
  },
};

class MirrorPathModule extends BaseSectPathModule {
  constructor() { super(mirrorDefinition, WUXIANG_MIRROR_NODES); }
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void {
    builder.setExtension(MIRROR_BUILD_FACADE, new MirrorBuildFacade(createWuxiangBuildSettings()));
  }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void {
    const facade = builder.requireExtension<MirrorBuildFacade>(MIRROR_BUILD_FACADE, '明镜照业构筑');
    compileWuxiangPath(builder, context.path.pathId, facade.settings);
  }
  createSelectionStrategy(tacticId: SectTacticId) { return new WuxiangMirrorSelectionStrategy(tacticId); }
}

class DemonPathModule extends BaseSectPathModule {
  constructor() { super(demonDefinition, WUXIANG_DEMON_NODES); }
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void {
    builder.setExtension(DEMON_BUILD_FACADE, new DemonBuildFacade(createWuxiangBuildSettings()));
  }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void {
    const facade = builder.requireExtension<DemonBuildFacade>(DEMON_BUILD_FACADE, '魔心渡厄构筑');
    compileWuxiangPath(builder, context.path.pathId, facade.settings);
  }
  createSelectionStrategy(tacticId: SectTacticId) { return new WuxiangDemonSelectionStrategy(tacticId); }
}

export const WUXIANG_MIRROR_PATH_MODULE = new MirrorPathModule();
export const WUXIANG_DEMON_PATH_MODULE = new DemonPathModule();
