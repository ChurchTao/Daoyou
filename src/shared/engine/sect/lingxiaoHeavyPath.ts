import { compileLingxiaoHeavy } from './content/lingxiao/combat/heavy';
import { HEAVY_SWORD_PATH_ID } from './content/lingxiao/ids';
import { defineLingxiaoNode } from './content/lingxiao/pathDefinition';
import { LingxiaoHeavySelectionStrategy } from './content/lingxiao/strategy/heavy';
import { DeterministicSectPathModule } from './pathModule';
import type {
  CultivatorSectPathState,
  SectCompiledBuild,
  SectPathDefinition,
  SectProjectionContext,
  SectTacticId,
} from './types';

export const HEAVY_NODES = [
  defineLingxiaoNode({
    id: 'heavy-opening',
    layer: 1,
    name: '开山',
    description: '开场获得2点剑架。',
  }),
  defineLingxiaoNode({
    id: 'heavy-hidden-weight',
    layer: 1,
    name: '藏重',
    description: '首次受到直接伤害降低10%，并获得3点剑架。',
  }),
  defineLingxiaoNode({
    id: 'heavy-testing-frame',
    layer: 1,
    name: '试架',
    description: '沉锋式每两次命中额外获得1点剑架并施加1层裂甲。',
  }),
  defineLingxiaoNode({
    id: 'heavy-triple-ridge',
    layer: 2,
    name: '三叠岳',
    description: '叠山式改为三段，总倍率1.5并获得3点剑架。',
  }),
  defineLingxiaoNode({
    id: 'heavy-shattering-armor',
    layer: 2,
    name: '碎甲',
    description: '叠山式改为施加2层裂甲。',
  }),
  defineLingxiaoNode({
    id: 'heavy-retained-frame',
    layer: 2,
    name: '留架',
    description: '每次行动最多将2点溢出剑架转为护盾。',
  }),
  defineLingxiaoNode({
    id: 'heavy-crossing-pass',
    layer: 3,
    name: '横关',
    description: '横岳式护盾与反击提高50%，反击施加裂甲。',
  }),
  defineLingxiaoNode({
    id: 'heavy-borrowed-weight',
    layer: 3,
    name: '借重',
    description: '每回合首次受到直接伤害时获得1点剑架。',
  }),
  defineLingxiaoNode({
    id: 'heavy-unmoved',
    layer: 3,
    name: '不移',
    description: '受控跳过行动时获得1点剑架，并使下一次承伤降低10%。',
  }),
  defineLingxiaoNode({
    id: 'heavy-rending-mountain',
    layer: 4,
    name: '裂岳',
    description: '破岳式消费裂甲时，每层追加0.18物攻无视防御伤害。',
  }),
  defineLingxiaoNode({
    id: 'heavy-ending-life',
    layer: 4,
    name: '断命',
    description: '目标气血低于25%时收束伤害提高30%。',
  }),
  defineLingxiaoNode({
    id: 'heavy-returning-peak',
    layer: 4,
    name: '回峰',
    description: '收束伤害降低20%，返还2点剑架并获得护盾。',
  }),
  defineLingxiaoNode({
    id: 'heavy-aftershock',
    layer: 5,
    name: '余震',
    description: '收束后延迟追加0.6物攻伤害，每回合最多一次。',
  }),
  defineLingxiaoNode({
    id: 'heavy-linked-mountains',
    layer: 5,
    name: '连山',
    description: '收束后下一次产架技能不耗法力并额外获得1点剑架。',
  }),
  defineLingxiaoNode({
    id: 'heavy-steady-mountain',
    layer: 5,
    name: '镇岳',
    description: '满剑架时承伤降低10%；连续两个行动未收束时强化下一次收束。',
  }),
  defineLingxiaoNode({
    id: 'heavy-heaven-cleaving',
    layer: 'ultimate',
    name: '开天',
    description: '开天断岳提高至3.5物攻、无视防御且冷却增加1回合。',
  }),
  defineLingxiaoNode({
    id: 'heavy-immovable-mountain',
    layer: 'ultimate',
    name: '不动如山',
    description: '镇山剑罡护盾提高50%，护盾存在时每次姿态可反击一次。',
  }),
  defineLingxiaoNode({
    id: 'heavy-mountain-river-echo',
    layer: 'ultimate',
    name: '山河回响',
    description: '收束后恢复气血并获得护盾，每3回合一次。',
  }),
];

export const HEAVY_SWORD_PATH: SectPathDefinition = {
  id: HEAVY_SWORD_PATH_ID,
  name: '重剑道',
  description: '以架承势、裂甲压阵、聚力破岳。',
  levelBenefitDescription: '每级提高重剑变体伤害、反击与护盾倍率0.08%。',
  defaultTacticId: 'heavy-break',
  nodes: HEAVY_NODES,
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

/** Heavy-sword plugin: definition, variants, meridians and tactics share one owner. */
class LingxiaoHeavyPathModule extends DeterministicSectPathModule {
  constructor() {
    super(HEAVY_SWORD_PATH);
  }

  protected compilePath(
    context: SectProjectionContext & { path: CultivatorSectPathState },
    base: Readonly<SectCompiledBuild>,
    activeNodeIds: ReadonlySet<string>,
  ): SectCompiledBuild {
    return compileLingxiaoHeavy(context, context.path, activeNodeIds, base);
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new LingxiaoHeavySelectionStrategy(tacticId);
  }
}

export const LINGXIAO_HEAVY_PATH_MODULE = new LingxiaoHeavyPathModule();
