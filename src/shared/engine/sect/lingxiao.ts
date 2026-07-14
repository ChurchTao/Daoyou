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
    {
      id: 'lingxiao-canon', name: '《凌霄剑典》', description: '凌霄剑宗总纲，统摄诸卷并决定择道与终式资格。',
      perLevelDescription: '限制各分卷可研习的最高等级。',
      milestones: [
        { id: 'lingxiao-path', level: 25, name: '快剑择道', description: '筑基后可择定快剑道。', minRealm: '筑基', minRealmStage: '初期' },
        { id: 'lingxiao-instant', level: 70, name: '刹那无痕前置', description: '与《疾风剑典》70级共同解锁终结剑式。', abilityId: 'instant-traceless', requiredPathId: 'swift-sword', requiredMethods: { 'swift-sword-canon': 70 } },
        { id: 'lingxiao-ultimate', level: 100, name: '终式前置', description: '与《疾风剑典》100级、化神圆满共同开启终式。', minRealm: '化神', minRealmStage: '圆满', requiredPathId: 'swift-sword', requiredMethods: { 'swift-sword-canon': 100 } },
      ],
    },
    {
      id: 'sword-guidance', name: '《御剑纲要》', description: '剑宗基础招式总录。', parentMethodId: 'lingxiao-canon',
      perLevelDescription: '每级提高0.05%物理攻击。', modifierPerLevel: { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.0005 },
      milestones: [
        { id: 'sword-plain', level: 1, name: '平剑式', description: '默认剑式；命中造成伤害并积累1点剑势。', abilityId: 'plain-sword' },
        { id: 'sword-guiding', level: 5, name: '引剑式', description: '产势剑式；快剑道下变为追风式。', abilityId: 'guiding-sword' },
        { id: 'sword-linked', level: 10, name: '连锋式', description: '多段连击并留下剑痕；快剑道下变为流光三叠。', abilityId: 'linked-edge' },
      ],
    },
    {
      id: 'void-step', name: '《凌虚步》', description: '身随剑走，主回身与踏影。', parentMethodId: 'lingxiao-canon',
      perLevelDescription: '每级提高0.04%身法。', modifierPerLevel: { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.0004 },
      milestones: [
        { id: 'void-turning', level: 15, name: '回身式', description: '防守反击剑式；快剑道下变为回燕式。', abilityId: 'turning-body' },
        { id: 'void-shadow', level: 30, name: '踏影', description: '造成伤害并提高下一回合身法。', abilityId: 'shadow-step' },
      ],
    },
    {
      id: 'edge-cleansing', name: '《洗锋录》', description: '洗去剑上滞意，观隙破锋。', parentMethodId: 'lingxiao-canon',
      perLevelDescription: '每级提高0.02个百分点命中。', modifierPerLevel: { attrType: AttributeType.ACCURACY, type: ModifierType.FIXED, value: 0.0002 },
      milestones: [{ id: 'edge-breaking', level: 20, name: '破锋式', description: '消耗剑势完成收束；快剑道下变为一线天。', abilityId: 'breaking-edge' }],
    },
    {
      id: 'origin-returning', name: '《归元诀》', description: '敛气归元，以剑罡护体。', parentMethodId: 'lingxiao-canon',
      perLevelDescription: '每级提高0.05%法力上限。', modifierPerLevel: { attrType: AttributeType.MAX_MP, type: ModifierType.ADD, value: 0.0005 },
      milestones: [{ id: 'origin-aegis', level: 20, name: '剑罡护体', description: '凝聚剑罡护盾，护盾存在时剑势不衰减。', abilityId: 'sword-aegis' }],
    },
    {
      id: 'swift-sword-canon', name: '《疾风剑典》', description: '快剑道专卷，以疾驭势，以势收剑。', parentMethodId: 'lingxiao-canon',
      perLevelDescription: '每级提高0.08%快剑招式倍率。', swiftTemplateMultiplierPerLevel: 0.0008,
      milestones: [
        { id: 'swift-instant', level: 70, name: '刹那无痕', description: '与《凌霄剑典》70级共同解锁六段终结剑式。', abilityId: 'instant-traceless', requiredPathId: 'swift-sword', requiredMethods: { 'lingxiao-canon': 70 } },
        { id: 'swift-ultimate', level: 100, name: '终式前置', description: '与《凌霄剑典》100级、化神圆满共同开启终式。', minRealm: '化神', minRealmStage: '圆满', requiredPathId: 'swift-sword', requiredMethods: { 'lingxiao-canon': 100 } },
      ],
    },
  ],
  abilities: [
    { id: 'plain-sword', baseName: '平剑式', description: '默认剑式，稳定造成伤害并积累剑势。', unlock: { methodId: 'sword-guidance', level: 1 }, occupiesActiveSlot: false, role: 'generator', manaWeight: 0, cooldown: 0, baseEffect: { damageCoefficient: 0.8, hits: 1, momentumGain: 1 } },
    { id: 'guiding-sword', baseName: '引剑式', swiftName: '追风式', description: '低耗无冷却的主要产势剑式。', unlock: { methodId: 'sword-guidance', level: 5 }, occupiesActiveSlot: true, role: 'generator', manaWeight: 1, cooldown: 0, baseEffect: { damageCoefficient: 0.85, hits: 1, momentumGain: 1 }, swiftEffect: { damageCoefficient: 0.9, hits: 1, momentumGain: 2 } },
    { id: 'linked-edge', baseName: '连锋式', swiftName: '流光三叠', description: '多段连击，产势并给目标留下剑痕。', unlock: { methodId: 'sword-guidance', level: 10 }, occupiesActiveSlot: true, role: 'combo', manaWeight: 1.5, cooldown: 2, baseEffect: { damageCoefficient: 0.42, hits: 3, momentumGain: 2, swordMarkLayers: 1 }, swiftEffect: { damageCoefficient: 0.42, hits: 3, momentumGain: 2, swordMarkLayers: 1 } },
    { id: 'turning-body', baseName: '回身式', swiftName: '回燕式', description: '进入回燕姿态，闪避敌招后反击并产势。', unlock: { methodId: 'void-step', level: 15 }, occupiesActiveSlot: true, role: 'defensive', manaWeight: 1.25, cooldown: 3, baseEffect: { damageCoefficient: 0.65, hits: 1, counterCoefficient: 0.55, momentumGain: 1 }, swiftEffect: { damageCoefficient: 0.65, hits: 1, counterCoefficient: 0.55, momentumGain: 1 } },
    { id: 'breaking-edge', baseName: '破锋式', swiftName: '一线天', description: '消耗全部剑势与剑痕，完成爆发收束。', unlock: { methodId: 'edge-cleansing', level: 20 }, occupiesActiveSlot: true, role: 'finisher', manaWeight: 1.75, cooldown: 2, baseEffect: { damageCoefficient: 1, hits: 1, momentumRequired: 3, consumesAllMomentum: true, consumesSwordMarks: true }, swiftEffect: { damageCoefficient: 1, hits: 1, momentumRequired: 3, consumesAllMomentum: true, consumesSwordMarks: true } },
    { id: 'sword-aegis', baseName: '剑罡护体', description: '凝聚护盾，护盾存在时剑势不会自然衰减。', unlock: { methodId: 'origin-returning', level: 20 }, occupiesActiveSlot: true, role: 'defensive', manaWeight: 1.5, cooldown: 3, baseEffect: { shieldCoefficient: 0.6 } },
    { id: 'shadow-step', baseName: '踏影', description: '造成伤害，并提高下一回合身法。', unlock: { methodId: 'void-step', level: 30 }, occupiesActiveSlot: true, role: 'generator', manaWeight: 1, cooldown: 2, baseEffect: { damageCoefficient: 0.55, hits: 1, speedBonus: 0.1 } },
    { id: 'instant-traceless', baseName: '刹那无痕', description: '消耗六点剑势发动六段快斩，完整命中返还一点剑势。', unlock: { methodId: 'swift-sword-canon', level: 70, pathId: 'swift-sword', primaryMethodLevel: 70 }, occupiesActiveSlot: true, role: 'finisher', manaWeight: 2.5, cooldown: 4, baseEffect: { damageCoefficient: 0.4, hits: 6, momentumRequired: 6, consumesAllMomentum: true, momentumGain: 1 } },
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
