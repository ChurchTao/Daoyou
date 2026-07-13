import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type {
  PlayerRaceDefinition,
  SectDefinition,
  SectMeridianNodeDefinition,
} from './types';

export const HUMAN_RACE: PlayerRaceDefinition = {
  id: 'human',
  name: '人族',
  description: '生于尘世而善悟百法，诸道皆可问、诸门皆可入。',
};

const SWIFT_NODES: SectMeridianNodeDefinition[] = [
  { id: 'swift-opening', layer: 1, name: '疾起', description: '开场获得2点剑势，第一回合身法提高8%。', minRealm: '筑基', minRealmStage: '初期' },
  { id: 'swift-hidden-edge', layer: 1, name: '藏锋', description: '首次伤害降低10%，但额外获得3点剑势。', minRealm: '筑基', minRealmStage: '初期' },
  { id: 'swift-probing-edge', layer: 1, name: '试锋', description: '平剑式每两次命中额外获得1点剑势并施加1层剑痕。', minRealm: '筑基', minRealmStage: '初期' },
  { id: 'swift-split-light', layer: 2, name: '分光', description: '流光三叠改为五段，总倍率1.35并获得3点剑势。', minRealm: '筑基', minRealmStage: '圆满' },
  { id: 'swift-stacking-waves', layer: 2, name: '叠浪', description: '流光三叠完整命中后，追风式冷却减少1回合。', minRealm: '筑基', minRealmStage: '圆满' },
  { id: 'swift-retained-force', layer: 2, name: '留势', description: '溢出剑势最多记录2点，下一次收束后返还。', minRealm: '筑基', minRealmStage: '圆满' },
  { id: 'swift-returning-swallow', layer: 3, name: '回燕', description: '回燕反击倍率提高50%，反击命中施加1层剑痕。', minRealm: '金丹', minRealmStage: '圆满' },
  { id: 'swift-borrowed-force', layer: 3, name: '借势', description: '每回合首次受到直接伤害时获得1点剑势。', minRealm: '金丹', minRealmStage: '圆满' },
  { id: 'swift-guarded-edge', layer: 3, name: '守锋', description: '被控制跳过行动时剑势不衰减，控制结束后首次产势额外+1。', minRealm: '金丹', minRealmStage: '圆满' },
  { id: 'swift-mountain-breaking', layer: 4, name: '破岳一线', description: '一线天消费剑痕产生无视防御的附加物理伤害。', minRealm: '元婴', minRealmStage: '圆满' },
  { id: 'swift-life-chasing', layer: 4, name: '追命一线', description: '目标气血低于25%时收束伤害提高30%。', minRealm: '元婴', minRealmStage: '圆满' },
  { id: 'swift-sheathing', layer: 4, name: '归鞘一线', description: '收束伤害降低20%，返还1点剑势并获得护盾。', minRealm: '元婴', minRealmStage: '圆满' },
  { id: 'swift-gapless', layer: 5, name: '无隙', description: '收束后下一次追风式不耗法力并额外获得1点剑势。', minRealm: '化神', minRealmStage: '中期' },
  { id: 'swift-linked-city', layer: 5, name: '连城', description: '多段技能完整命中时，其他快剑技能冷却减少1回合，每回合一次。', minRealm: '化神', minRealmStage: '中期' },
  { id: 'swift-still-tide', layer: 5, name: '静潮', description: '连续两个自身行动未收束后暂停剑势衰减，下一次收束提高20%。', minRealm: '化神', minRealmStage: '中期' },
  { id: 'swift-endless-flow', layer: 'ultimate', name: '无间剑流', description: '收束后追加0.6物攻追击并获得1点剑势，每3回合一次。', minRealm: '化神', minRealmStage: '圆满', requiredMethods: { 'lingxiao-canon': 100, 'swift-sword-canon': 100 } },
  { id: 'swift-shadow-line', layer: 'ultimate', name: '绝影一线', description: '一线天改为满6剑势强击，强制暴击且冷却增加1回合。', minRealm: '化神', minRealmStage: '圆满', requiredMethods: { 'lingxiao-canon': 100, 'swift-sword-canon': 100 } },
  { id: 'swift-unending-wind', layer: 'ultimate', name: '回风不息', description: '回燕反击施加剑痕并获得护盾，每次姿态最多一次。', minRealm: '化神', minRealmStage: '圆满', requiredMethods: { 'lingxiao-canon': 100, 'swift-sword-canon': 100 } },
];

export const LINGXIAO_SECT: SectDefinition = {
  id: 'lingxiao',
  name: '凌霄剑宗',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    { id: 'lingxiao-canon', name: '《凌霄剑典》', description: '凌霄剑宗总纲，统摄诸卷并决定择道与终式资格。' },
    { id: 'sword-guidance', name: '《御剑纲要》', description: '剑宗基础招式总录。', parentMethodId: 'lingxiao-canon', modifierPerLevel: { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.0005 } },
    { id: 'void-step', name: '《凌虚步》', description: '身随剑走，主回身与踏影。', parentMethodId: 'lingxiao-canon', modifierPerLevel: { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.0004 } },
    { id: 'edge-cleansing', name: '《洗锋录》', description: '洗去剑上滞意，观隙破锋。', parentMethodId: 'lingxiao-canon', modifierPerLevel: { attrType: AttributeType.ACCURACY, type: ModifierType.FIXED, value: 0.0002 } },
    { id: 'origin-returning', name: '《归元诀》', description: '敛气归元，以剑罡护体。', parentMethodId: 'lingxiao-canon', modifierPerLevel: { attrType: AttributeType.MAX_MP, type: ModifierType.ADD, value: 0.0005 } },
    { id: 'swift-sword-canon', name: '《疾风剑典》', description: '快剑道专卷，以疾驭势，以势收剑。', parentMethodId: 'lingxiao-canon', swiftTemplateMultiplierPerLevel: 0.0008 },
  ],
  abilities: [
    { id: 'plain-sword', baseName: '平剑式', description: '剑宗基础攻击，命中积累剑势。', unlock: { methodId: 'sword-guidance', level: 1 }, occupiesActiveSlot: false },
    { id: 'guiding-sword', baseName: '引剑式', swiftName: '追风式', description: '引气入锋，快剑道下化作追风。', unlock: { methodId: 'sword-guidance', level: 5 }, occupiesActiveSlot: true },
    { id: 'linked-edge', baseName: '连锋式', swiftName: '流光三叠', description: '连锋递进，快剑道下化作三叠流光。', unlock: { methodId: 'sword-guidance', level: 10 }, occupiesActiveSlot: true },
    { id: 'turning-body', baseName: '回身式', swiftName: '回燕式', description: '回身护隙，闪避后反击。', unlock: { methodId: 'void-step', level: 15 }, occupiesActiveSlot: true },
    { id: 'breaking-edge', baseName: '破锋式', swiftName: '一线天', description: '消费剑势收束一击。', unlock: { methodId: 'edge-cleansing', level: 20 }, occupiesActiveSlot: true },
    { id: 'sword-aegis', baseName: '剑罡护体', description: '凝剑罡为盾。', unlock: { methodId: 'origin-returning', level: 20 }, occupiesActiveSlot: true },
    { id: 'shadow-step', baseName: '踏影', description: '剑随影至，提升下一回合身法。', unlock: { methodId: 'void-step', level: 30 }, occupiesActiveSlot: true },
    { id: 'instant-traceless', baseName: '刹那无痕', description: '六势齐发，刹那六斩。', unlock: { methodId: 'swift-sword-canon', level: 70, pathId: 'swift-sword', primaryMethodLevel: 70 }, occupiesActiveSlot: true },
  ],
  paths: [{ id: 'swift-sword', name: '快剑道', description: '抢先积势、连锋留痕、择机收束。', nodes: SWIFT_NODES }],
  tactics: [
    { id: 'aggressive', name: '急攻', description: '三势即收，优先追击低血目标。' },
    { id: 'steady', name: '稳势', description: '尽量蓄满六势，再以完整倍率收束。' },
    { id: 'counter', name: '回风', description: '优先回燕与剑罡，五势以上再收束。' },
  ],
};

export const LINGXIAO_METHOD_BY_ID = new Map(
  LINGXIAO_SECT.methods.map((method) => [method.id, method]),
);
export const LINGXIAO_ABILITY_BY_ID = new Map(
  LINGXIAO_SECT.abilities.map((ability) => [ability.id, ability]),
);
export const LINGXIAO_NODE_BY_ID = new Map(
  SWIFT_NODES.map((node) => [node.id, node]),
);
