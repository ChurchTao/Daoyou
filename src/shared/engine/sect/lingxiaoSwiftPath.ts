import { compileLingxiaoSwift } from './content/lingxiao/combat/swift';
import { SWIFT_SWORD_PATH_ID } from './content/lingxiao/ids';
import { defineLingxiaoNode } from './content/lingxiao/pathDefinition';
import { LingxiaoSwiftSelectionStrategy } from './content/lingxiao/strategy/swift';
import { DeterministicSectPathModule } from './pathModule';
import type {
  CultivatorSectPathState,
  SectCompiledBuild,
  SectPathDefinition,
  SectProjectionContext,
  SectTacticId,
} from './types';

export const SWIFT_NODES = [
  defineLingxiaoNode({
    id: 'swift-opening',
    layer: 1,
    name: '疾起',
    description: '开场获得2点剑势，第一回合身法提高8%。',
  }),
  defineLingxiaoNode({
    id: 'swift-hidden-edge',
    layer: 1,
    name: '藏锋',
    description: '首次受到直接伤害降低10%，并额外获得3点剑势。',
  }),
  defineLingxiaoNode({
    id: 'swift-probing-edge',
    layer: 1,
    name: '试锋',
    description: '平剑式每两次命中额外获得1点剑势并施加1层剑痕。',
  }),
  defineLingxiaoNode({
    id: 'swift-split-light',
    layer: 2,
    name: '分光',
    description: '流光三叠改为五段，总倍率1.35并获得3点剑势。',
  }),
  defineLingxiaoNode({
    id: 'swift-stacking-waves',
    layer: 2,
    name: '叠浪',
    description: '流光三叠完整命中后，追风式冷却减少1回合。',
  }),
  defineLingxiaoNode({
    id: 'swift-retained-force',
    layer: 2,
    name: '留势',
    description: '溢出剑势最多记录2点，下一次收束后返还。',
  }),
  defineLingxiaoNode({
    id: 'swift-returning-swallow',
    layer: 3,
    name: '回燕',
    description: '回燕反击倍率提高50%，反击命中施加1层剑痕。',
  }),
  defineLingxiaoNode({
    id: 'swift-borrowed-force',
    layer: 3,
    name: '借势',
    description: '每回合首次受到直接伤害时获得1点剑势。',
  }),
  defineLingxiaoNode({
    id: 'swift-guarded-edge',
    layer: 3,
    name: '守锋',
    description: '被控制跳过行动时剑势不衰减，控制结束后首次产势额外+1。',
  }),
  defineLingxiaoNode({
    id: 'swift-mountain-breaking',
    layer: 4,
    name: '破岳一线',
    description: '一线天消费剑痕产生无视防御的附加物理伤害。',
  }),
  defineLingxiaoNode({
    id: 'swift-life-chasing',
    layer: 4,
    name: '追命一线',
    description: '目标气血低于25%时收束伤害提高30%。',
  }),
  defineLingxiaoNode({
    id: 'swift-sheathing',
    layer: 4,
    name: '归鞘一线',
    description: '收束伤害降低20%，返还1点剑势并获得护盾。',
  }),
  defineLingxiaoNode({
    id: 'swift-gapless',
    layer: 5,
    name: '无隙',
    description: '收束后下一次追风式不耗法力并额外获得1点剑势。',
  }),
  defineLingxiaoNode({
    id: 'swift-linked-city',
    layer: 5,
    name: '连城',
    description: '多段技能完整命中时，其他快剑技能冷却减少1回合，每回合一次。',
  }),
  defineLingxiaoNode({
    id: 'swift-still-tide',
    layer: 5,
    name: '静潮',
    description: '连续两个自身行动未收束后暂停剑势衰减，下一次收束提高20%。',
  }),
  defineLingxiaoNode({
    id: 'swift-endless-flow',
    layer: 'ultimate',
    name: '无间剑流',
    description: '收束后追加0.6物攻追击并获得1点剑势，每3回合一次。',
  }),
  defineLingxiaoNode({
    id: 'swift-shadow-line',
    layer: 'ultimate',
    name: '绝影一线',
    description: '一线天改为满6剑势强击，强制暴击且冷却增加1回合。',
  }),
  defineLingxiaoNode({
    id: 'swift-unending-wind',
    layer: 'ultimate',
    name: '回风不息',
    description: '回燕反击施加剑痕并获得护盾，每次姿态最多一次。',
  }),
];

export const SWIFT_SWORD_PATH: SectPathDefinition = {
  id: SWIFT_SWORD_PATH_ID,
  name: '快剑道',
  description: '抢先积势、连锋留痕、择机收束。',
  levelBenefitDescription: '每级提高快剑变体伤害、反击与护盾倍率0.08%。',
  defaultTacticId: 'aggressive',
  nodes: SWIFT_NODES,
  tactics: [
    {
      id: 'aggressive',
      name: '急攻',
      description: '三势即收，优先追击低血目标。',
    },
    {
      id: 'steady',
      name: '稳势',
      description: '尽量蓄满六势，再以完整倍率收束。',
    },
    {
      id: 'counter',
      name: '回风',
      description: '优先回燕与剑罡，五势以上再收束。',
    },
  ],
};

/** Quick-sword plugin: definition, variants, meridians and tactics share one owner. */
class LingxiaoSwiftPathModule extends DeterministicSectPathModule {
  constructor() {
    super(SWIFT_SWORD_PATH);
  }

  protected compilePath(
    context: SectProjectionContext & { path: CultivatorSectPathState },
    base: Readonly<SectCompiledBuild>,
    activeNodeIds: ReadonlySet<string>,
  ): SectCompiledBuild {
    return compileLingxiaoSwift(context, context.path, activeNodeIds, base);
  }

  createSelectionStrategy(tacticId: SectTacticId) {
    return new LingxiaoSwiftSelectionStrategy(tacticId);
  }
}

export const LINGXIAO_SWIFT_PATH_MODULE = new LingxiaoSwiftPathModule();
