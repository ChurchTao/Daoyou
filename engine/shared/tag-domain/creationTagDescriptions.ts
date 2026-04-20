/**
 * creationTagDescriptions: 造物标签语义描述 MAP。
 * 供 LLM 语义标签提取器使用，提升标签分配精度。
 */
import { CreationTags } from './creationTags';

export interface TagDescription {
  name: string;
  description: string;
  examples: string;
}

export const CREATION_TAG_DESCRIPTIONS: Record<string, TagDescription> = {
  // ========== 27 语义标签 ==========
  [CreationTags.MATERIAL.SEMANTIC_FLAME]: {
    name: '火焰',
    description: '与火、炎、灼烧、赤炎相关的材料',
    examples: '赤炎石、火蟒鳞、烈焰花、焚天晶',
  },
  [CreationTags.MATERIAL.SEMANTIC_FREEZE]: {
    name: '冰寒',
    description: '与冰、寒、霜、冻结相关的材料',
    examples: '寒冰髓、霜纹铁、冰魄草、玄冰石',
  },
  [CreationTags.MATERIAL.SEMANTIC_THUNDER]: {
    name: '雷霆',
    description: '与雷、电、霆、闪电相关的材料',
    examples: '雷灵珠、霆锤碎片、紫电石、引雷铁',
  },
  [CreationTags.MATERIAL.SEMANTIC_WIND]: {
    name: '风行',
    description: '与风、气流、岚、轻灵敏捷相关的材料',
    examples: '风灵羽、岚石、旋风叶、飘渺纱',
  },
  [CreationTags.MATERIAL.SEMANTIC_BLADE]: {
    name: '锋刃',
    description: '与锋利、刃器、攻伐、杀伤力相关的材料',
    examples: '锐金砂、蛟龙爪、破阵枪头、斩灵铁',
  },
  [CreationTags.MATERIAL.SEMANTIC_GUARD]: {
    name: '防护',
    description: '与防御、护盾、坚壁、守护相关的材料',
    examples: '玄铁甲片、龟壳碎片、护心石、金刚木',
  },
  [CreationTags.MATERIAL.SEMANTIC_BURST]: {
    name: '爆发',
    description: '与爆裂、暴烈、瞬间高威力、激发相关的材料',
    examples: '暴怒丹、爆裂矿、烈性精华、狂化血',
  },
  [CreationTags.MATERIAL.SEMANTIC_SUSTAIN]: {
    name: '恢复',
    description: '与持续回复、疗愈、滋养、维持相关的材料',
    examples: '生息草、回春露、养元丹、疗伤药',
  },
  [CreationTags.MATERIAL.SEMANTIC_MANUAL]: {
    name: '典籍',
    description: '与经书、秘卷、传承知识、功法心得相关的材料',
    examples: '破壁残卷、古法拓本、仙人手札、心法碎片',
  },
  [CreationTags.MATERIAL.SEMANTIC_SPIRIT]: {
    name: '灵识',
    description: '与灵魂、神魂、灵力本源、法术能量相关的材料',
    examples: '灵魂碎片、魄石、灵力结晶、聚灵珠',
  },
  [CreationTags.MATERIAL.SEMANTIC_EARTH]: {
    name: '土脉',
    description: '与土、石、山岩、大地、厚重相关的材料',
    examples: '厚土精、山岩石、岳灵砂、坤元土',
  },
  [CreationTags.MATERIAL.SEMANTIC_METAL]: {
    name: '金铁',
    description: '与金属、铸炼、钢铁、锐利矿物相关的材料',
    examples: '寒铁锭、精钢、秘银矿、百炼金精',
  },
  [CreationTags.MATERIAL.SEMANTIC_WATER]: {
    name: '水流',
    description: '与水、潮汐、泉源、流动柔和相关的材料',
    examples: '灵泉水、潮汐石、碧波珠、净水露',
  },
  [CreationTags.MATERIAL.SEMANTIC_WOOD]: {
    name: '草木',
    description: '与木、林、植物生长、藤蔓、根系相关的材料',
    examples: '古木芯、灵藤、万年根须、青木精',
  },
  [CreationTags.MATERIAL.SEMANTIC_POISON]: {
    name: '毒瘴',
    description: '与毒素、腐蚀、瘴气、蛊虫相关的材料',
    examples: '蝎尾毒腺、毒雾草、腐蚀液、瘴气精华',
  },
  [CreationTags.MATERIAL.SEMANTIC_DIVINE]: {
    name: '神圣',
    description: '与神力、天授、圣光、纯净之力相关的材料',
    examples: '圣光石、天赐玉、神木枝、祈灵珠',
  },
  [CreationTags.MATERIAL.SEMANTIC_SPACE]: {
    name: '空间',
    description: '与空间折叠、界域、虚空、位移相关的材料',
    examples: '虚空碎片、空间裂隙石、折界珠、次元晶',
  },
  [CreationTags.MATERIAL.SEMANTIC_TIME]: {
    name: '时间',
    description: '与时光、岁月、轮转、瞬移加速相关的材料',
    examples: '岁月沙、时光碎片、刻痕石、轮回木',
  },
  [CreationTags.MATERIAL.SEMANTIC_LIFE]: {
    name: '生机',
    description: '与生命力、复苏、萌芽、生生不息相关的材料',
    examples: '生命之种、复苏花、万灵草、不死根',
  },
  [CreationTags.MATERIAL.SEMANTIC_ALCHEMY]: {
    name: '丹道',
    description: '与炼丹、药性、丹炉、药材调配相关的材料',
    examples: '炉中丹火、药引草、丹砂、灵药粉',
  },
  [CreationTags.MATERIAL.SEMANTIC_REFINING]: {
    name: '器道',
    description: '与炼器、锻造、器胚、熔炼铸造相关的材料',
    examples: '器胚铁、熔炉碎片、锻造石、铸魂金',
  },
  [CreationTags.MATERIAL.SEMANTIC_BEAST]: {
    name: '妖兽',
    description: '与妖、兽、蛟龙、野性力量相关的材料',
    examples: '蛟龙鳞、虎骨、妖兽内丹、凶兽角',
  },
  [CreationTags.MATERIAL.SEMANTIC_BLOOD]: {
    name: '血煞',
    description: '与血液、气血、煞气、精血相关的材料',
    examples: '精血石、血煞珠、龙血精、血髓',
  },
  [CreationTags.MATERIAL.SEMANTIC_BONE]: {
    name: '骨甲',
    description: '与骨骼、甲壳、角刺、坚硬骨质相关的材料',
    examples: '龙骨、妖兽甲壳、鹿角碎片、骨刺',
  },
  [CreationTags.MATERIAL.SEMANTIC_FORMATION]: {
    name: '阵纹',
    description: '与阵法、禁制、符文、阵图相关的材料',
    examples: '阵图碎片、符文石、禁制令牌、刻纹玉',
  },
  [CreationTags.MATERIAL.SEMANTIC_ILLUSION]: {
    name: '幻术',
    description: '与幻象、迷惑、蜃楼、精神干扰相关的材料',
    examples: '蜃气珠、幻灵花、迷神香、梦境沙',
  },
  [CreationTags.MATERIAL.SEMANTIC_QI]: {
    name: '灵气',
    description: '与灵气浓度、元气、真元、灵压相关的材料',
    examples: '聚灵阵石、灵息草、元炁珠、灵压晶',
  },

  // ========== 8 材料类型标签 ==========
  [CreationTags.MATERIAL.TYPE_HERB]: {
    name: '药材',
    description: '草药、花果、灵植类材料',
    examples: '灵芝、千年参、回春草、朱果',
  },
  [CreationTags.MATERIAL.TYPE_ORE]: {
    name: '矿石',
    description: '矿石、金属矿、晶石类材料',
    examples: '寒铁矿、灵晶石、精金矿、玄石',
  },
  [CreationTags.MATERIAL.TYPE_MONSTER]: {
    name: '妖兽材料',
    description: '妖兽掉落物：鳞片、骨角、内丹等',
    examples: '蛟龙鳞、妖兽内丹、凤尾羽、虎骨',
  },
  [CreationTags.MATERIAL.TYPE_MANUAL]: {
    name: '典籍',
    description: '功法秘籍、神通手札、经书残卷',
    examples: '太初经残卷、道德真经、秘术手札',
  },
  [CreationTags.MATERIAL.TYPE_GONGFA_MANUAL]: {
    name: '功法典籍',
    description: '专门记载功法修炼之法的典籍',
    examples: '紫阳心经、玄天功法、太虚炼体诀',
  },
  [CreationTags.MATERIAL.TYPE_SKILL_MANUAL]: {
    name: '神通典籍',
    description: '专门记载神通秘术的典籍',
    examples: '落雷诀残卷、火龙术心得、冰封千里秘录',
  },
  [CreationTags.MATERIAL.TYPE_SPECIAL]: {
    name: '天材地宝',
    description: '罕见珍稀的天然宝物，通常用于高级造物',
    examples: '万年灵芝、天外陨铁、龙涎珠、凤血石',
  },
  [CreationTags.MATERIAL.TYPE_AUXILIARY]: {
    name: '辅料',
    description: '辅助性材料，用于调和、催化或增益',
    examples: '灵泥、催化粉、调和液、增益符',
  },
};
