import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type {
  PlayerRaceDefinition,
  SectDefinition,
  SectMeridianNodeDefinition,
  SectPathDefinition,
} from './types';

export const LINGXIAO_SECT_ID = 'lingxiao';
export const SWIFT_SWORD_PATH_ID = 'swift-sword';
export const HEAVY_SWORD_PATH_ID = 'heavy-sword';

export const HUMAN_RACE: PlayerRaceDefinition = {
  id: 'human',
  name: '人族',
  description: '生于尘世而善悟百法，诸道皆可问、诸门皆可入。',
};

const LAYER_REQUIREMENTS = {
  1: { minRealm: '筑基', minRealmStage: '初期', minPathLevel: 5 },
  2: { minRealm: '筑基', minRealmStage: '圆满', minPathLevel: 15 },
  3: { minRealm: '金丹', minRealmStage: '圆满', minPathLevel: 30 },
  4: { minRealm: '元婴', minRealmStage: '圆满', minPathLevel: 50 },
  5: { minRealm: '化神', minRealmStage: '中期', minPathLevel: 70 },
  ultimate: { minRealm: '化神', minRealmStage: '圆满', minPathLevel: 100 },
} as const;

function node(
  definition: Omit<SectMeridianNodeDefinition, 'minRealm' | 'minRealmStage' | 'minPathLevel'>,
): SectMeridianNodeDefinition {
  return { ...definition, ...LAYER_REQUIREMENTS[definition.layer] };
}

export const SWIFT_NODES: SectMeridianNodeDefinition[] = [
  node({ id: 'swift-opening', layer: 1, name: '疾起', description: '开场获得2点剑势，第一回合身法提高8%。' }),
  node({ id: 'swift-hidden-edge', layer: 1, name: '藏锋', description: '首次受到直接伤害降低10%，并额外获得3点剑势。' }),
  node({ id: 'swift-probing-edge', layer: 1, name: '试锋', description: '平剑式每两次命中额外获得1点剑势并施加1层剑痕。' }),
  node({ id: 'swift-split-light', layer: 2, name: '分光', description: '流光三叠改为五段，总倍率1.35并获得3点剑势。' }),
  node({ id: 'swift-stacking-waves', layer: 2, name: '叠浪', description: '流光三叠完整命中后，追风式冷却减少1回合。' }),
  node({ id: 'swift-retained-force', layer: 2, name: '留势', description: '溢出剑势最多记录2点，下一次收束后返还。' }),
  node({ id: 'swift-returning-swallow', layer: 3, name: '回燕', description: '回燕反击倍率提高50%，反击命中施加1层剑痕。' }),
  node({ id: 'swift-borrowed-force', layer: 3, name: '借势', description: '每回合首次受到直接伤害时获得1点剑势。' }),
  node({ id: 'swift-guarded-edge', layer: 3, name: '守锋', description: '被控制跳过行动时剑势不衰减，控制结束后首次产势额外+1。' }),
  node({ id: 'swift-mountain-breaking', layer: 4, name: '破岳一线', description: '一线天消费剑痕产生无视防御的附加物理伤害。' }),
  node({ id: 'swift-life-chasing', layer: 4, name: '追命一线', description: '目标气血低于25%时收束伤害提高30%。' }),
  node({ id: 'swift-sheathing', layer: 4, name: '归鞘一线', description: '收束伤害降低20%，返还1点剑势并获得护盾。' }),
  node({ id: 'swift-gapless', layer: 5, name: '无隙', description: '收束后下一次追风式不耗法力并额外获得1点剑势。' }),
  node({ id: 'swift-linked-city', layer: 5, name: '连城', description: '多段技能完整命中时，其他快剑技能冷却减少1回合，每回合一次。' }),
  node({ id: 'swift-still-tide', layer: 5, name: '静潮', description: '连续两个自身行动未收束后暂停剑势衰减，下一次收束提高20%。' }),
  node({ id: 'swift-endless-flow', layer: 'ultimate', name: '无间剑流', description: '收束后追加0.6物攻追击并获得1点剑势，每3回合一次。' }),
  node({ id: 'swift-shadow-line', layer: 'ultimate', name: '绝影一线', description: '一线天改为满6剑势强击，强制暴击且冷却增加1回合。' }),
  node({ id: 'swift-unending-wind', layer: 'ultimate', name: '回风不息', description: '回燕反击施加剑痕并获得护盾，每次姿态最多一次。' }),
];

export const HEAVY_NODES: SectMeridianNodeDefinition[] = [
  node({ id: 'heavy-opening', layer: 1, name: '开山', description: '开场获得2点剑架。' }),
  node({ id: 'heavy-hidden-weight', layer: 1, name: '藏重', description: '首次受到直接伤害降低10%，并获得3点剑架。' }),
  node({ id: 'heavy-testing-frame', layer: 1, name: '试架', description: '沉锋式每两次命中额外获得1点剑架并施加1层裂甲。' }),
  node({ id: 'heavy-triple-ridge', layer: 2, name: '三叠岳', description: '叠山式改为三段，总倍率1.5并获得3点剑架。' }),
  node({ id: 'heavy-shattering-armor', layer: 2, name: '碎甲', description: '叠山式改为施加2层裂甲。' }),
  node({ id: 'heavy-retained-frame', layer: 2, name: '留架', description: '每次行动最多将2点溢出剑架转为护盾。' }),
  node({ id: 'heavy-crossing-pass', layer: 3, name: '横关', description: '横岳式护盾与反击提高50%，反击施加裂甲。' }),
  node({ id: 'heavy-borrowed-weight', layer: 3, name: '借重', description: '每回合首次受到直接伤害时获得1点剑架。' }),
  node({ id: 'heavy-unmoved', layer: 3, name: '不移', description: '受控跳过行动时获得1点剑架，并使下一次承伤降低10%。' }),
  node({ id: 'heavy-rending-mountain', layer: 4, name: '裂岳', description: '破岳式消费裂甲时，每层追加0.18物攻无视防御伤害。' }),
  node({ id: 'heavy-ending-life', layer: 4, name: '断命', description: '目标气血低于25%时收束伤害提高30%。' }),
  node({ id: 'heavy-returning-peak', layer: 4, name: '回峰', description: '收束伤害降低20%，返还2点剑架并获得护盾。' }),
  node({ id: 'heavy-aftershock', layer: 5, name: '余震', description: '收束后延迟追加0.6物攻伤害，每回合最多一次。' }),
  node({ id: 'heavy-linked-mountains', layer: 5, name: '连山', description: '收束后下一次产架技能不耗法力并额外获得1点剑架。' }),
  node({ id: 'heavy-steady-mountain', layer: 5, name: '镇岳', description: '满剑架时承伤降低10%；连续两个行动未收束时强化下一次收束。' }),
  node({ id: 'heavy-heaven-cleaving', layer: 'ultimate', name: '开天', description: '开天断岳提高至3.5物攻、无视防御且冷却增加1回合。' }),
  node({ id: 'heavy-immovable-mountain', layer: 'ultimate', name: '不动如山', description: '镇山剑罡护盾提高50%，护盾存在时每次姿态可反击一次。' }),
  node({ id: 'heavy-mountain-river-echo', layer: 'ultimate', name: '山河回响', description: '收束后恢复气血并获得护盾，每3回合一次。' }),
];

export const SWIFT_SWORD_PATH: SectPathDefinition = {
  id: SWIFT_SWORD_PATH_ID,
  name: '快剑道',
  description: '抢先积势、连锋留痕、择机收束。',
  levelBenefitDescription: '每级提高快剑变体伤害、反击与护盾倍率0.08%。',
  defaultTacticId: 'aggressive',
  nodes: SWIFT_NODES,
  tactics: [
    { id: 'aggressive', name: '急攻', description: '三势即收，优先追击低血目标。' },
    { id: 'steady', name: '稳势', description: '尽量蓄满六势，再以完整倍率收束。' },
    { id: 'counter', name: '回风', description: '优先回燕与剑罡，五势以上再收束。' },
  ],
};

export const HEAVY_SWORD_PATH: SectPathDefinition = {
  id: HEAVY_SWORD_PATH_ID,
  name: '重剑道',
  description: '以架承势、裂甲压阵、聚力破岳。',
  levelBenefitDescription: '每级提高重剑变体伤害、反击与护盾倍率0.08%。',
  defaultTacticId: 'heavy-break',
  nodes: HEAVY_NODES,
  tactics: [
    { id: 'heavy-break', name: '破阵', description: '三架即收，优先叠甲与斩杀。' },
    { id: 'heavy-full', name: '镇岳', description: '蓄满六架，以开天断岳破敌。' },
    { id: 'heavy-guard', name: '守关', description: '优先横剑与剑罡，五架以上再收束。' },
  ],
};

export const LINGXIAO_SECT: SectDefinition = {
  id: LINGXIAO_SECT_ID,
  name: '凌霄剑宗',
  description: '拜山问剑，研习六卷心法，于快重二道中自定剑途。',
  trial: {
    name: '入门试剑',
    description: '借宗门法器体验基础传承，胜负皆记作完成。',
  },
  raceIds: ['human'],
  configVersion: 2,
  methods: [
    {
      id: 'lingxiao-canon', slot: 1, name: '《凌霄剑典》', isPrimary: true,
      description: '凌霄剑宗总纲，统摄诸卷并承载宗门绝式。',
      perLevelDescription: '限制各基础分卷可研习的最高等级。',
      milestones: [
        { id: 'canon-plain', level: 1, name: '平剑式', description: '凌霄弟子的基础剑式。', abilityId: 'plain-sword' },
        { id: 'canon-ultimate', level: 70, name: '凌霄绝式', description: '宗门绝式会随当前流派演化。', abilityId: 'sect-ultimate' },
      ],
    },
    {
      id: 'sword-guidance', slot: 2, name: '《御剑纲要》', description: '剑宗基础招式总录。',
      perLevelDescription: '每级提高0.05%物理攻击。', modifierPerLevel: { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.0005 },
      milestones: [
        { id: 'sword-guiding', level: 5, name: '引剑式', description: '稳定进攻剑式。', abilityId: 'guiding-sword' },
        { id: 'sword-linked', level: 10, name: '连锋式', description: '多段连击剑式。', abilityId: 'linked-edge' },
      ],
    },
    {
      id: 'void-step', slot: 3, name: '《凌虚步》', description: '身随剑走，主回身与踏影。',
      perLevelDescription: '每级提高0.04%身法。', modifierPerLevel: { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.0004 },
      milestones: [
        { id: 'void-turning', level: 15, name: '回身式', description: '防守反击剑式。', abilityId: 'turning-body' },
        { id: 'void-shadow', level: 30, name: '踏影', description: '攻守转换的身法剑式。', abilityId: 'shadow-step' },
      ],
    },
    {
      id: 'edge-cleansing', slot: 4, name: '《洗锋录》', description: '洗去剑上滞意，观隙破锋。',
      perLevelDescription: '每级提高0.02个百分点命中。', modifierPerLevel: { attrType: AttributeType.ACCURACY, type: ModifierType.FIXED, value: 0.0002 },
      milestones: [{ id: 'edge-breaking', level: 20, name: '破锋式', description: '积势后的收束剑式。', abilityId: 'breaking-edge' }],
    },
    {
      id: 'origin-returning', slot: 5, name: '《归元诀》', description: '敛气归元，以剑罡护体。',
      perLevelDescription: '每级提高0.05%法力上限。', modifierPerLevel: { attrType: AttributeType.MAX_MP, type: ModifierType.ADD, value: 0.0005 },
      milestones: [{ id: 'origin-aegis', level: 20, name: '剑罡护体', description: '凝聚剑罡护盾。', abilityId: 'sword-aegis' }],
    },
    {
      id: 'sword-nurturing', slot: 6, name: '《养剑诀》', description: '以气血温养剑意，兼顾恢复与护持。',
      perLevelDescription: '每级提高0.05%气血上限。', modifierPerLevel: { attrType: AttributeType.MAX_HP, type: ModifierType.ADD, value: 0.0005 },
      milestones: [{ id: 'nurturing-sword', level: 20, name: '养剑式', description: '恢复气血并获得护盾。', abilityId: 'nurturing-sword' }],
    },
  ],
  abilities: [
    { id: 'plain-sword', methodId: 'lingxiao-canon', baseName: '平剑式', description: '默认剑式。', unlockLevel: 1, occupiesActiveSlot: false, role: 'generator', manaWeight: 0, cooldown: 0 },
    { id: 'sect-ultimate', methodId: 'lingxiao-canon', baseName: '凌霄绝式', description: '随流派演化的宗门绝式。', unlockLevel: 70, occupiesActiveSlot: true, role: 'finisher', manaWeight: 2.5, cooldown: 4 },
    { id: 'guiding-sword', methodId: 'sword-guidance', baseName: '引剑式', description: '低耗的基础进攻剑式。', unlockLevel: 5, occupiesActiveSlot: true, role: 'generator', manaWeight: 1, cooldown: 0 },
    { id: 'linked-edge', methodId: 'sword-guidance', baseName: '连锋式', description: '多段连击。', unlockLevel: 10, occupiesActiveSlot: true, role: 'combo', manaWeight: 1.5, cooldown: 2 },
    { id: 'turning-body', methodId: 'void-step', baseName: '回身式', description: '进入防守反击姿态。', unlockLevel: 15, occupiesActiveSlot: true, role: 'defensive', manaWeight: 1.25, cooldown: 3 },
    { id: 'shadow-step', methodId: 'void-step', baseName: '踏影', description: '攻击并强化下一回合身法。', unlockLevel: 30, occupiesActiveSlot: true, role: 'generator', manaWeight: 1, cooldown: 2 },
    { id: 'breaking-edge', methodId: 'edge-cleansing', baseName: '破锋式', description: '消耗积势完成爆发收束。', unlockLevel: 20, occupiesActiveSlot: true, role: 'finisher', manaWeight: 1.75, cooldown: 2 },
    { id: 'sword-aegis', methodId: 'origin-returning', baseName: '剑罡护体', description: '凝聚护盾。', unlockLevel: 20, occupiesActiveSlot: true, role: 'defensive', manaWeight: 1.5, cooldown: 3 },
    { id: 'nurturing-sword', methodId: 'sword-nurturing', baseName: '养剑式', description: '恢复气血并获得护盾。', unlockLevel: 20, occupiesActiveSlot: true, role: 'utility', manaWeight: 1.5, cooldown: 4 },
  ],
  paths: [SWIFT_SWORD_PATH, HEAVY_SWORD_PATH],
  onboarding: {
    initialContribution: 30,
    initialMethods: { 'lingxiao-canon': 5, 'sword-guidance': 5 },
    initialAbilityLoadout: ['guiding-sword', null, null, null],
  },
};

export const LINGXIAO_METHOD_BY_ID = new Map(LINGXIAO_SECT.methods.map((method) => [method.id, method]));
export const LINGXIAO_ABILITY_BY_ID = new Map(LINGXIAO_SECT.abilities.map((ability) => [ability.id, ability]));
export const LINGXIAO_PATH_BY_ID = new Map(LINGXIAO_SECT.paths.map((path) => [path.id, path]));
export const LINGXIAO_NODE_BY_ID = new Map(LINGXIAO_SECT.paths.flatMap((path) => path.nodes).map((entry) => [entry.id, entry]));
