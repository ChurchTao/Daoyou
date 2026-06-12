import type { ConditionResourceKey } from '@shared/types/condition';
import type {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  MaterialType,
  SkillType,
  StatusEffect,
} from '@shared/types/constants';
import type { Attributes } from '@shared/types/cultivator';

export interface GameConceptDisplayInfo {
  label: string;
  icon: string;
  shortLabel?: string;
  description?: string;
  aliases?: Record<string, string>;
}

export const GAME_CONCEPT_DISPLAY_MAP = {
  hp: {
    label: '气血',
    icon: '❤️',
    description: '当前气血、气血条、恢复气血',
  },
  mp: {
    label: '法力',
    icon: '💧',
    description: '当前法力、法力条、法力消耗',
  },
  maxHp: {
    label: '气血上限',
    icon: '❤️',
    description: '最大气血',
  },
  maxMp: {
    label: '法力上限',
    icon: '💧',
    description: '最大法力',
  },
  hp_loss: {
    label: '气血损失',
    icon: '🩸',
    description: '气血百分比损失',
  },
  mp_loss: {
    label: '法力损失',
    icon: '💧',
    description: '法力百分比损失',
  },
  spirit_stones: {
    label: '灵石',
    icon: '💰',
    description: '通用货币',
  },
  reputation: {
    label: '声望',
    icon: '🏵️',
    description: '天骄宝阁兑换所需的声望',
  },
  cultivation_exp: {
    label: '修为',
    icon: '🧘',
    description: '修为进度',
  },
  comprehension_insight: {
    label: '道心感悟',
    shortLabel: '感悟',
    icon: '💡',
    description: '突破、推演功法与神通所需的感悟',
  },
  world_qi: {
    label: '天地灵气',
    shortLabel: '灵气',
    icon: '🍃',
    description: '玩法行动所消耗的天地灵气',
  },
  lifespan: {
    label: '寿元',
    icon: '🕯️',
    description: '角色寿元',
  },
  material: {
    label: '材料',
    icon: '📦',
    description: '通用材料',
  },
  artifact: {
    label: '法宝',
    icon: '🗡️',
    description: '法宝物品',
    aliases: {
      naming: '法宝灵器',
    },
  },
  consumable: {
    label: '消耗品',
    icon: '💊',
    description: '丹药、符箓等消耗品',
  },
  battle: {
    label: '战斗',
    icon: '⚔️',
    description: '战斗事件或代价',
  },
  weak: {
    label: '虚弱',
    icon: '😰',
    description: '虚弱状态',
  },
  artifact_damage: {
    label: '法宝受损',
    icon: '💥',
    description: '法宝受损代价',
  },
  vitality: {
    label: '体魄',
    icon: '💪',
    shortLabel: '体',
    description: '肉身强度与气血根基，影响伤害减免与生命上限',
  },
  spirit: {
    label: '灵力',
    icon: '⚡',
    shortLabel: '灵',
    description: '灵力浑厚程度，影响法术威力与法力上限',
  },
  wisdom: {
    label: '悟性',
    icon: '🧠',
    shortLabel: '悟',
    description: '领悟与推演之能，影响暴击、顿悟与突破',
  },
  speed: {
    label: '身法',
    icon: '🦶',
    shortLabel: '速',
    description: '身形遁速与出手先后，影响闪避与出手顺序',
  },
  willpower: {
    label: '神识',
    icon: '👁️',
    shortLabel: '识',
    description: '神魂坚韧程度，影响状态抗性、暴击伤害',
  },
  gongfa: {
    label: '功法',
    icon: '📖',
    description: '功法产品',
    aliases: {
      naming: '功法典籍',
    },
  },
  skill: {
    label: '神通',
    icon: '📜',
    description: '神通产品',
    aliases: {
      naming: '神通招式',
    },
  },
  consumable_pill: {
    label: '丹药',
    icon: '🌕',
    description: '丹药消耗品',
  },
  consumable_talisman: {
    label: '符箓',
    icon: '📜',
    description: '符箓消耗品',
  },
  material_herb: {
    label: '灵药',
    icon: '🌿',
  },
  material_ore: {
    label: '矿石',
    icon: '🪨',
  },
  material_monster: {
    label: '妖兽材料',
    icon: '🐉',
  },
  material_tcdb: {
    label: '天材地宝',
    icon: '💎',
  },
  material_aux: {
    label: '特殊辅料',
    icon: '💧',
  },
  material_gongfa_manual: {
    label: '功法典籍',
    icon: '📖',
  },
  material_skill_manual: {
    label: '神通秘术',
    icon: '📜',
  },
  element_metal: {
    label: '金',
    icon: '⚔️',
  },
  element_wood: {
    label: '木',
    icon: '🌿',
  },
  element_water: {
    label: '水',
    icon: '💧',
  },
  element_fire: {
    label: '火',
    icon: '🔥',
  },
  element_earth: {
    label: '土',
    icon: '⛰️',
  },
  element_wind: {
    label: '风',
    icon: '🌪️',
  },
  element_thunder: {
    label: '雷',
    icon: '⚡',
  },
  element_ice: {
    label: '冰',
    icon: '❄️',
  },
  equipment_weapon: {
    label: '攻击法宝',
    icon: '🗡️',
    aliases: {
      intent: '武器',
      naming: '战器',
      productNaming: '兵刃',
    },
  },
  equipment_armor: {
    label: '护身法宝',
    icon: '🛡️',
    aliases: {
      intent: '护甲',
      naming: '护甲',
      productNaming: '护具',
    },
  },
  equipment_accessory: {
    label: '辅助法宝',
    icon: '💍',
    aliases: {
      intent: '配饰',
      naming: '玉佩',
      productNaming: '饰物',
    },
  },
  attribute_atk: {
    label: '物理攻击',
    icon: '⚔️',
    shortLabel: '物攻',
  },
  attribute_def: {
    label: '物理防御',
    icon: '🛡️',
    shortLabel: '物防',
  },
  attribute_magic_atk: {
    label: '法术攻击',
    icon: '⚡',
    shortLabel: '法攻',
  },
  attribute_magic_def: {
    label: '法术防御',
    icon: '🛡️',
    shortLabel: '法防',
  },
  attribute_crit_rate: {
    label: '暴击率',
    icon: '🎯',
    shortLabel: '暴',
  },
  attribute_crit_damage: {
    label: '暴击伤害',
    icon: '💥',
    shortLabel: '暴伤',
  },
  attribute_damage_reduction: {
    label: '伤害减免',
    icon: '🛡️',
    shortLabel: '减伤',
  },
  attribute_hit_rate: {
    label: '命中率',
    icon: '🎯',
    shortLabel: '命',
  },
  attribute_dodge_rate: {
    label: '闪避率',
    icon: '🏃‍♂️',
    shortLabel: '闪避',
  },
  attribute_evasion_rate: {
    label: '闪避率',
    icon: '🏃‍♂️',
    shortLabel: '闪避',
  },
  attribute_control_hit: {
    label: '控制命中',
    icon: '🎯',
    shortLabel: '控命',
  },
  attribute_control_resistance: {
    label: '控制抗性',
    icon: '🛡️',
    shortLabel: '控抗',
  },
  attribute_armor_penetration: {
    label: '破防',
    icon: '🗡️',
    shortLabel: '破防',
    aliases: {
      detailed: '破甲',
    },
  },
  attribute_magic_penetration: {
    label: '法术穿透',
    icon: '⚡',
    shortLabel: '法穿',
    aliases: {
      compact: '法穿',
    },
  },
  attribute_crit_resist: {
    label: '暴击抗性',
    icon: '🛡️',
    shortLabel: '暴抗',
    aliases: {
      detailed: '暴击韧性',
    },
  },
  attribute_crit_damage_reduction: {
    label: '暴伤减免',
    icon: '🛡️',
    shortLabel: '暴减',
    aliases: {
      detailed: '暴击减伤',
    },
  },
  attribute_accuracy: {
    label: '命中',
    icon: '🎯',
    shortLabel: '命中',
    aliases: {
      detailed: '精准',
    },
  },
  attribute_heal_amplify: {
    label: '治疗加成',
    icon: '💚',
    shortLabel: '治疗',
    aliases: {
      detailed: '治疗增强',
    },
  },
  skill_type_attack: {
    label: '攻击',
    icon: '⚔️',
    description: '以伤害为主的直接输出神通',
  },
  skill_type_heal: {
    label: '治疗',
    icon: '💚',
    description: '恢复气血或护持自身的术法',
  },
  skill_type_control: {
    label: '控制',
    icon: '🌀',
    description: '封禁、禁锢、限制对手行动的术法',
  },
  skill_type_debuff: {
    label: '削弱',
    icon: '😈',
    description: '削减对手战力或叠加负面状态的术法',
  },
  skill_type_buff: {
    label: '增益',
    icon: '🌟',
    description: '临时强化自身或友方能力的神通',
  },
  status_burn: {
    label: '灼烧',
    icon: '🔥',
    description: '业火缠身，每回合损失气血',
  },
  status_bleed: {
    label: '流血',
    icon: '🩸',
    description: '伤口难愈，随时间流失气血',
  },
  status_poison: {
    label: '中毒',
    icon: '☠️',
    description: '剧毒入骨，气血与法力缓慢流逝',
  },
  status_stun: {
    label: '眩晕',
    icon: '🌀',
    description: '元神震荡，暂时无法行动',
  },
  status_silence: {
    label: '沉默',
    icon: '🤐',
    description: '法咒受限，无法施展部分神通',
  },
  status_root: {
    label: '定身',
    icon: '🔒',
    description: '身形被禁锢，难以移动与闪避',
  },
  status_armor_up: {
    label: '护体',
    icon: '🛡️',
    description: '护体罡气环绕，大幅减免伤害',
  },
  status_speed_up: {
    label: '疾速',
    icon: '🏃‍♂️',
    description: '身形如电，出手与闪避皆获加成',
  },
  status_crit_rate_up: {
    label: '会心',
    icon: '🎯',
    description: '战意如虹，暴击几率大幅提升',
  },
  status_armor_down: {
    label: '破防',
    icon: '💔',
    description: '护体被破，所受伤害显著增加',
  },
  status_crit_rate_down: {
    label: '暴击降低',
    icon: '💔',
    description: '暴击几率大幅降低',
  },
  status_weakness: {
    label: '虚弱',
    icon: '😰',
    description: '元气大伤，战力大幅下降',
  },
  status_minor_wound: {
    label: '轻伤',
    icon: '🩹',
    description: '身负轻伤，稍有影响',
  },
  status_major_wound: {
    label: '重伤',
    icon: '💥',
    description: '身负重伤，实力大损',
  },
  status_near_death: {
    label: '濒死',
    icon: '☠️',
    description: '命悬一线，随时可能陨落',
  },
  status_breakthrough_focus: {
    label: '破境凝神',
    icon: '🕯️',
    description: '心神收束，为下一次破境做足准备',
  },
  status_protect_meridians: {
    label: '护脉',
    icon: '🪢',
    description: '药力护住经脉，可减轻破境反噬',
  },
  status_clear_mind: {
    label: '清心',
    icon: '🪷',
    description: '心境澄明，可减少杂念干扰',
  },
  status_artifact_damaged: {
    label: '法宝受损',
    icon: '💔',
    description: '法宝损坏，威力大减',
  },
  status_mana_depleted: {
    label: '法力枯竭',
    icon: '💧',
    description: '法力耗尽，难以施展术法',
  },
  status_hp_deficit: {
    label: '气血不足',
    icon: '❤️',
    description: '气血亏虚，行动受限',
  },
  status_scorching: {
    label: '酷热',
    icon: '🌡️',
    description: '烈日当空，持续受到灼烧',
  },
  status_freezing: {
    label: '严寒',
    icon: '❄️',
    description: '天寒地冻，行动迟缓',
  },
  status_toxic_air: {
    label: '瘴气',
    icon: '☁️',
    description: '毒气弥漫，持续中毒',
  },
  status_formation_suppressed: {
    label: '阵法压制',
    icon: '⛓️',
    description: '被阵法压制，实力受限',
  },
  status_abundant_qi: {
    label: '灵气充沛',
    icon: '🍃',
    description: '灵气浓郁，修炼速度提升',
  },
} as const satisfies Record<string, GameConceptDisplayInfo>;

export type GameConceptKey = keyof typeof GAME_CONCEPT_DISPLAY_MAP;

function getConceptInfo(key: GameConceptKey): { label: string; icon: string } {
  const info = getGameConceptInfo(key);
  return {
    label: info.label,
    icon: info.icon,
  };
}

export type ResourceTextKey =
  | ConditionResourceKey
  | 'maxHp'
  | 'maxMp'
  | 'cultivation_exp'
  | 'hp_loss'
  | 'mp_loss';

const RESOURCE_MAX_KEY_BY_RESOURCE: Record<
  ConditionResourceKey,
  Extract<ResourceTextKey, 'maxHp' | 'maxMp'>
> = {
  hp: 'maxHp',
  mp: 'maxMp',
};

const RESOURCE_LOSS_KEY_BY_RESOURCE: Record<
  ConditionResourceKey,
  Extract<ResourceTextKey, 'hp_loss' | 'mp_loss'>
> = {
  hp: 'hp_loss',
  mp: 'mp_loss',
};

export function getResourceText(key: ResourceTextKey): string {
  return getGameConceptLabel(key);
}

export function getResourceLabel(resource: ConditionResourceKey): string {
  return getResourceText(resource);
}

export function getResourceMaxLabel(resource: ConditionResourceKey): string {
  return getResourceText(RESOURCE_MAX_KEY_BY_RESOURCE[resource]);
}

export function getResourceLossLabel(resource: ConditionResourceKey): string {
  return getResourceText(RESOURCE_LOSS_KEY_BY_RESOURCE[resource]);
}

export function getResourceRestoreText(resource: ConditionResourceKey): string {
  return `恢复${getResourceLabel(resource)}`;
}

export function getResourceIcon(type: string): string {
  return getGameConceptIcon(type) || '❔';
}

export function getResourceDisplayName(type: string): string {
  return getGameConceptLabel(type);
}

export interface ElementDisplayInfo {
  label: string;
  icon: string;
}

const ELEMENT_CONCEPT_KEYS: Record<ElementType, GameConceptKey> = {
  金: 'element_metal',
  木: 'element_wood',
  水: 'element_water',
  火: 'element_fire',
  土: 'element_earth',
  风: 'element_wind',
  雷: 'element_thunder',
  冰: 'element_ice',
};

export const ELEMENT_DISPLAY_MAP: Record<ElementType, ElementDisplayInfo> = {
  金: getConceptInfo(ELEMENT_CONCEPT_KEYS.金),
  木: getConceptInfo(ELEMENT_CONCEPT_KEYS.木),
  水: getConceptInfo(ELEMENT_CONCEPT_KEYS.水),
  火: getConceptInfo(ELEMENT_CONCEPT_KEYS.火),
  土: getConceptInfo(ELEMENT_CONCEPT_KEYS.土),
  风: getConceptInfo(ELEMENT_CONCEPT_KEYS.风),
  雷: getConceptInfo(ELEMENT_CONCEPT_KEYS.雷),
  冰: getConceptInfo(ELEMENT_CONCEPT_KEYS.冰),
};

export function getElementInfo(key: ElementType): ElementDisplayInfo {
  return (
    ELEMENT_DISPLAY_MAP[key] ?? {
      label: key,
      icon: '',
    }
  );
}

/**
 * 展示层用属性键：基础 5 维 + battle-v5 派生键。
 * Attributes 已被精简为仅保留基础 5 维，但 UI 显示仍需覆盖派生键。
 */
export type AttributeKey =
  | keyof Attributes
  | 'critRate'
  | 'critDamage'
  | 'damageReduction'
  | 'flatDamageReduction'
  | 'hitRate'
  | 'dodgeRate';

export interface AttributeDisplayInfo {
  label: string;
  icon: string;
  shortLabel: string;
  description: string;
}

function getAttributeConceptInfo(key: GameConceptKey): AttributeDisplayInfo {
  const info = getGameConceptInfo(key);
  return {
    label: info.label,
    icon: info.icon,
    shortLabel: info.shortLabel ?? info.label,
    description: info.description ?? '',
  };
}

export const ATTRIBUTE_DISPLAY_MAP: Record<AttributeKey, AttributeDisplayInfo> =
  {
    vitality: getAttributeConceptInfo('vitality'),
    spirit: getAttributeConceptInfo('spirit'),
    wisdom: getAttributeConceptInfo('wisdom'),
    speed: getAttributeConceptInfo('speed'),
    willpower: getAttributeConceptInfo('willpower'),
    critRate: getAttributeConceptInfo('attribute_crit_rate'),
    critDamage: getAttributeConceptInfo('attribute_crit_damage'),
    damageReduction: getAttributeConceptInfo('attribute_damage_reduction'),
    flatDamageReduction: getAttributeConceptInfo('attribute_damage_reduction'),
    hitRate: getAttributeConceptInfo('attribute_hit_rate'),
    dodgeRate: getAttributeConceptInfo('attribute_dodge_rate'),
  };

export function getAttributeLabel(key: AttributeKey): string {
  return ATTRIBUTE_DISPLAY_MAP[key]?.label ?? key;
}

export function getAttributeInfo(key: AttributeKey): AttributeDisplayInfo {
  return (
    ATTRIBUTE_DISPLAY_MAP[key] ?? {
      label: key,
      icon: '',
      shortLabel: key,
      description: '',
    }
  );
}

export interface SkillTypeDisplayInfo {
  label: string;
  icon: string;
  description: string;
}

function getSkillTypeConceptInfo(key: GameConceptKey): SkillTypeDisplayInfo {
  const info = getGameConceptInfo(key);
  return {
    label: info.label,
    icon: info.icon,
    description: info.description ?? '',
  };
}

export const SKILL_TYPE_DISPLAY_MAP: Record<SkillType, SkillTypeDisplayInfo> = {
  attack: getSkillTypeConceptInfo('skill_type_attack'),
  heal: getSkillTypeConceptInfo('skill_type_heal'),
  control: getSkillTypeConceptInfo('skill_type_control'),
  debuff: getSkillTypeConceptInfo('skill_type_debuff'),
  buff: getSkillTypeConceptInfo('skill_type_buff'),
};

export function getSkillTypeLabel(type: SkillType): string {
  return SKILL_TYPE_DISPLAY_MAP[type]?.label ?? type;
}

export function getSkillTypeInfo(type: SkillType): SkillTypeDisplayInfo {
  return (
    SKILL_TYPE_DISPLAY_MAP[type] ?? {
      label: type,
      icon: '',
      description: '',
    }
  );
}

export interface StatusEffectDisplayInfo {
  label: string;
  icon: string;
  description: string;
}

function getStatusConceptInfo(key: GameConceptKey): StatusEffectDisplayInfo {
  const info = getGameConceptInfo(key);
  return {
    label: info.label,
    icon: info.icon,
    description: info.description ?? '',
  };
}

export const STATUS_EFFECT_DISPLAY_MAP: Record<
  StatusEffect,
  StatusEffectDisplayInfo
> = {
  burn: getStatusConceptInfo('status_burn'),
  bleed: getStatusConceptInfo('status_bleed'),
  poison: getStatusConceptInfo('status_poison'),
  stun: getStatusConceptInfo('status_stun'),
  silence: getStatusConceptInfo('status_silence'),
  root: getStatusConceptInfo('status_root'),
  armor_up: getStatusConceptInfo('status_armor_up'),
  speed_up: getStatusConceptInfo('status_speed_up'),
  crit_rate_up: getStatusConceptInfo('status_crit_rate_up'),
  armor_down: getStatusConceptInfo('status_armor_down'),
  crit_rate_down: getStatusConceptInfo('status_crit_rate_down'),
  weakness: getStatusConceptInfo('status_weakness'),
  minor_wound: getStatusConceptInfo('status_minor_wound'),
  major_wound: getStatusConceptInfo('status_major_wound'),
  near_death: getStatusConceptInfo('status_near_death'),
  breakthrough_focus: getStatusConceptInfo('status_breakthrough_focus'),
  protect_meridians: getStatusConceptInfo('status_protect_meridians'),
  clear_mind: getStatusConceptInfo('status_clear_mind'),
  artifact_damaged: getStatusConceptInfo('status_artifact_damaged'),
  mana_depleted: getStatusConceptInfo('status_mana_depleted'),
  hp_deficit: getStatusConceptInfo('status_hp_deficit'),
  scorching: getStatusConceptInfo('status_scorching'),
  freezing: getStatusConceptInfo('status_freezing'),
  toxic_air: getStatusConceptInfo('status_toxic_air'),
  formation_suppressed: getStatusConceptInfo('status_formation_suppressed'),
  abundant_qi: getStatusConceptInfo('status_abundant_qi'),
};

export function getStatusLabel(effect: StatusEffect): string {
  return STATUS_EFFECT_DISPLAY_MAP[effect]?.label ?? effect;
}

export function getStatusEffectInfo(
  effect: StatusEffect,
): StatusEffectDisplayInfo {
  return (
    STATUS_EFFECT_DISPLAY_MAP[effect] ?? {
      label: effect,
      icon: '',
      description: '',
    }
  );
}

export interface EquipmentSlotDisplayInfo {
  label: string;
  icon: string;
}

export const EQUIPMENT_SLOT_DISPLAY_MAP: Record<
  EquipmentSlot,
  EquipmentSlotDisplayInfo
> = {
  weapon: getConceptInfo('equipment_weapon'),
  armor: getConceptInfo('equipment_armor'),
  accessory: getConceptInfo('equipment_accessory'),
};

export function getEquipmentSlotLabel(slot: EquipmentSlot): string {
  return EQUIPMENT_SLOT_DISPLAY_MAP[slot]?.label ?? slot;
}

export function getEquipmentSlotInfo(
  slot: EquipmentSlot,
): EquipmentSlotDisplayInfo {
  return (
    EQUIPMENT_SLOT_DISPLAY_MAP[slot] ?? {
      label: slot,
      icon: '',
    }
  );
}

export interface ConsumableTypeDisplayInfo {
  label: string;
  icon: string;
}

export const CONSUMABLE_TYPE_DISPLAY_MAP: Record<
  ConsumableType,
  ConsumableTypeDisplayInfo
> = {
  丹药: getConceptInfo('consumable_pill'),
  符箓: getConceptInfo('consumable_talisman'),
};

export function getConsumableTypeLabel(type: ConsumableType): string {
  return CONSUMABLE_TYPE_DISPLAY_MAP[type]?.label ?? type;
}

export interface MaterialTypeDisplayInfo {
  label: string;
  icon: string;
}

export const MATERIAL_TYPE_DISPLAY_MAP: Record<
  MaterialType,
  MaterialTypeDisplayInfo
> = {
  herb: getConceptInfo('material_herb'),
  ore: getConceptInfo('material_ore'),
  monster: getConceptInfo('material_monster'),
  tcdb: getConceptInfo('material_tcdb'),
  aux: getConceptInfo('material_aux'),
  gongfa_manual: getConceptInfo('material_gongfa_manual'),
  skill_manual: getConceptInfo('material_skill_manual'),
};

export function getMaterialTypeLabel(type: MaterialType): string {
  return MATERIAL_TYPE_DISPLAY_MAP[type]?.label ?? type;
}

export function getMaterialTypeInfo(
  type: MaterialType,
): MaterialTypeDisplayInfo {
  return (
    MATERIAL_TYPE_DISPLAY_MAP[type] ?? {
      label: type,
      icon: '',
    }
  );
}

export interface ResourceTypeDisplayInfo {
  label: string;
  icon: string;
}

export const RESOURCE_TYPE_DISPLAY_MAP: Record<
  string,
  ResourceTypeDisplayInfo
> = {
  hp: getConceptInfo('hp'),
  mp: getConceptInfo('mp'),
  maxHp: getConceptInfo('maxHp'),
  maxMp: getConceptInfo('maxMp'),
  spirit_stones: getConceptInfo('spirit_stones'),
  reputation: getConceptInfo('reputation'),
  lifespan: getConceptInfo('lifespan'),
  cultivation_exp: getConceptInfo('cultivation_exp'),
  comprehension_insight: getConceptInfo('comprehension_insight'),
  world_qi: getConceptInfo('world_qi'),
  material: getConceptInfo('material'),
  artifact: getConceptInfo('artifact'),
  consumable: getConceptInfo('consumable'),
  hp_loss: getConceptInfo('hp_loss'),
  mp_loss: getConceptInfo('mp_loss'),
  weak: getConceptInfo('weak'),
  battle: getConceptInfo('battle'),
  artifact_damage: getConceptInfo('artifact_damage'),
};

export function getResourceTypeLabel(type: string): string {
  return RESOURCE_TYPE_DISPLAY_MAP[type]?.label ?? type;
}

export function getResourceTypeInfo(type: string): ResourceTypeDisplayInfo {
  return (
    RESOURCE_TYPE_DISPLAY_MAP[type] ?? {
      label: type,
      icon: '',
    }
  );
}

const CREATION_PRODUCT_TYPE_CONCEPT_KEYS = {
  artifact: 'artifact',
  gongfa: 'gongfa',
  skill: 'skill',
} as const satisfies Record<string, GameConceptKey>;

const EQUIPMENT_SLOT_CONCEPT_KEYS = {
  weapon: 'equipment_weapon',
  armor: 'equipment_armor',
  accessory: 'equipment_accessory',
} as const satisfies Record<string, GameConceptKey>;

export function getGameConceptInfo(key: string): GameConceptDisplayInfo {
  return (
    GAME_CONCEPT_DISPLAY_MAP[key as GameConceptKey] ?? {
      label: key,
      icon: '',
    }
  );
}

export function getGameConceptLabel(key: string): string {
  return getGameConceptInfo(key).label;
}

export function getGameConceptIcon(key: string): string {
  return getGameConceptInfo(key).icon;
}

export function getGameConceptVariantLabel(
  key: string,
  variant: string,
): string {
  const info = getGameConceptInfo(key);
  if (variant === 'short' && info.shortLabel) {
    return info.shortLabel;
  }
  return info.aliases?.[variant] ?? info.label;
}

export function getCreationProductTypeLabel(
  productType: string,
  variant?: string,
): string {
  const key =
    CREATION_PRODUCT_TYPE_CONCEPT_KEYS[
      productType as keyof typeof CREATION_PRODUCT_TYPE_CONCEPT_KEYS
    ];
  if (!key) {
    return productType;
  }
  return variant
    ? getGameConceptVariantLabel(key, variant)
    : getGameConceptLabel(key);
}

export function getEquipmentSlotConceptLabel(
  slot: string,
  variant?: string,
): string {
  const key =
    EQUIPMENT_SLOT_CONCEPT_KEYS[
      slot as keyof typeof EQUIPMENT_SLOT_CONCEPT_KEYS
    ];
  if (!key) {
    return slot;
  }
  return variant
    ? getGameConceptVariantLabel(key, variant)
    : getGameConceptLabel(key);
}
