import {
  BaseSectPathModule,
  STANDARD_PATH_LAYERS,
  type SectBuildBuilder,
  type SectPathCompileContext,
  type SectPathDefinitionWithoutNodes,
  type SectTacticId,
} from '../../core';
import { compileWuxiangPath, WUXIANG_FEATURES, type WuxiangFeatures } from './compiler';
import { WUXIANG_DEMON_PATH_ID, WUXIANG_MIRROR_PATH_ID } from './ids';
import { WUXIANG_DEMON_NODES, WUXIANG_MIRROR_NODES } from './nodes';
import { WuxiangDemonSelectionStrategy, WuxiangMirrorSelectionStrategy } from './strategy';

const mirrorDefinition: SectPathDefinitionWithoutNodes = {
  id: WUXIANG_MIRROR_PATH_ID,
  name: '明镜照业',
  description: '以承受制造因，以魔相兑现果。来力不急于拒绝，只把每一道因果照还原处。',
  minRealm: '筑基', minRealmStage: '初期', layers: [...STANDARD_PATH_LAYERS], defaultTacticId: 'guard',
  tactics: [
    { id: 'guard', name: '守镜', description: '优先保持3层业痕与防守状态，5点战意后入魔。' },
    { id: 'present', name: '现报', description: '至少1层业痕且达到3点战意便入魔，优先引爆业门与转还状态。' },
    { id: 'formless', name: '无相', description: '原则上积满6点战意；低于35%气血时允许提前入魔自救。' },
  ],
  presentation: {
    highlights: [
      { name: '受击留业', description: '敌方直接伤害留下业痕，并在佛相即时反伤。' },
      { name: '现报兑现', description: '两次魔相神通消费业痕，改变技能的战术功能。' },
      { name: '一念两照', description: '无相式同时设局与现报，并把业痕重置为可继续周转的起点。' },
    ],
    abilityChanges: {
      'flower-heart': '佛相立戒，魔相封招，无相兼施两者。',
      'blood-tide': '佛相延伤，魔相回澜，无相同时延伤与返还。',
      'three-knocks': '佛相留下业门，魔相引爆余门。',
      'observe-calamity': '佛相架势承劫，魔相按受击次数见劫。',
      'five-skandhas': '在增益、减益与业痕之间进行状态交换。',
      'reed-crossing': '分别提供伤害上限、伤害转还与二者合一。',
      'turn-form': '3至5战意进入两式魔相，6战意令下一门神通化为无相。',
    },
  },
};

const demonDefinition: SectPathDefinitionWithoutNodes = {
  id: WUXIANG_DEMON_PATH_ID,
  name: '魔心渡厄',
  description: '以佛相主动沉血，以两次魔相完成连招。气血不是怒气的别名，而是必须偿还的渡河之资。',
  minRealm: '筑基', minRealmStage: '初期', layers: [...STANDARD_PATH_LAYERS], defaultTacticId: 'trial-fire',
  tactics: [
    { id: 'trial-fire', name: '试火', description: '3点战意且低于60%气血入魔，优先延伤与保命。' },
    { id: 'sink-boat', name: '沉舟', description: '积至5点战意并主动压到45%以下，以血潮、三叩收束。' },
    { id: 'one-thought', name: '一念', description: '优先积满6点战意使用无相；低于25%时允许提前入魔。' },
  ],
  presentation: {
    highlights: [
      { name: '主动沉血', description: '佛相支付气血并跨越三条血线，以此加速战意循环。' },
      { name: '两式成招', description: '第一门生成魔契，第二门消费魔契完成不同技能间的连招。' },
      { name: '短窗求生', description: '霸体、减伤与吸血只存在于转相窗口，必须用两次行动解决局面。' },
    ],
    abilityChanges: {
      'flower-heart': '留下心隙，再以渡厄摘心收束。',
      'blood-tide': '佛相储存实际气血成本，魔相把血潮转为伤害。',
      'three-knocks': '随自身低血强化第三叩，渡厄式可强制暴击。',
      'observe-calamity': '延期债务不会消失，但可在渡厄时照向目标。',
      'five-skandhas': '负面状态既可移交，也可作为焚烧增伤的薪柴。',
      'reed-crossing': '佛相控制单次受击，魔相在濒危时兼具收束与回血。',
      'turn-form': '3至5战意开启两段连招，6战意把入魔与渡厄压入一次行动。',
    },
  },
};

abstract class WuxiangPathModule extends BaseSectPathModule {
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void {
    builder.setExtension<WuxiangFeatures>(WUXIANG_FEATURES, new Set());
  }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void {
    compileWuxiangPath(
      builder,
      context.path.pathId,
      builder.requireExtension<WuxiangFeatures>(WUXIANG_FEATURES, '无相道途循环规则'),
    );
  }
}

class MirrorPathModule extends WuxiangPathModule {
  constructor() { super(mirrorDefinition, WUXIANG_MIRROR_NODES); }
  createSelectionStrategy(tacticId: SectTacticId) { return new WuxiangMirrorSelectionStrategy(tacticId); }
}

class DemonPathModule extends WuxiangPathModule {
  constructor() { super(demonDefinition, WUXIANG_DEMON_NODES); }
  createSelectionStrategy(tacticId: SectTacticId) { return new WuxiangDemonSelectionStrategy(tacticId); }
}

export const WUXIANG_MIRROR_PATH_MODULE = new MirrorPathModule();
export const WUXIANG_DEMON_PATH_MODULE = new DemonPathModule();
