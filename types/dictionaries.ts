import type {
  Attributes,
  Artifact,
  Skill,
} from './cultivator';
import type {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  SkillType,
  StatusEffect,
} from './constants';

// ===== 元素相关 =====

export interface ElementDisplayInfo {
  label: string;
  icon: string;
}

export const ELEMENT_DISPLAY_MAP: Record<ElementType, ElementDisplayInfo> = {
  金: {
    label:'金',
    icon:'⚔️',
  },
  木: {
    label:'木',
    icon:'🌿',
  },
  水: {
    label:'水',
    icon:'💧',
  },
  火: {
    label:'火',
    icon:'🔥',
  },
  土: {
    label:'土',
    icon:'⛰️',
  },
  风: {
    label:'风',
    icon:'🌪️',
  },
  雷: {
    label:'雷',
    icon:'⚡️️',
  },
  冰: {
    label:'冰',
    icon:'❄️',
  },
};

export function getElementInfo(key: ElementType): ElementDisplayInfo {
  return ELEMENT_DISPLAY_MAP[key] ?? {
    label: key,
    icon: '',
  };
}


// ===== 属性相关 =====

export type AttributeKey = keyof Attributes;

export interface AttributeDisplayInfo {
  label: string;
  icon: string;
  shortLabel: string;
  description: string;
}

export const ATTRIBUTE_DISPLAY_MAP: Record<AttributeKey, AttributeDisplayInfo> =
  {
    vitality: {
      label: '体魄',
      icon: '💪',
      shortLabel: '体',
      description: '肉身强度与气血根基，影响伤害减免与生命上限',
    },
    spirit: {
      label: '灵力',
      icon: '⚡️️',
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
      description: '神魂坚韧程度，影响状态抗性与神识对冲',
    },
  };

export function getAttributeLabel(key: AttributeKey): string {
  return ATTRIBUTE_DISPLAY_MAP[key]?.label ?? key;
}

export function getAttributeInfo(key: AttributeKey): AttributeDisplayInfo {
  return ATTRIBUTE_DISPLAY_MAP[key] ?? {
    label: key,
    icon: '',
    shortLabel: key,
    description: '',
  };
}

// ===== 技能类型 =====

export interface SkillTypeDisplayInfo {
  label: string;
  icon: string;
  description: string;
}

export const SKILL_TYPE_DISPLAY_MAP: Record<SkillType, SkillTypeDisplayInfo> = {
  attack: {
    label: '攻击',
    icon: '⚔️',
    description: '以伤害为主的直接输出神通',
  },
  heal: {
    label: '治疗',
    icon: '💚',
    description: '恢复气血或护持自身的术法',
  },
  control: {
    label: '控制',
    icon: '🌀',
    description: '封禁、禁锢、限制对手行动的术法',
  },
  debuff: {
    label: '削弱',
    icon: '😈',
    description: '削减对手战力或叠加负面状态的术法',
  },
  buff: {
    label: '增益',
    icon: '🌟',
    description: '临时强化自身或友方能力的神通',
  },
};

export function getSkillTypeLabel(type: SkillType): string {
  return SKILL_TYPE_DISPLAY_MAP[type]?.label ?? type;
}


export function getSkillTypeInfo(type: SkillType): SkillTypeDisplayInfo {
  return SKILL_TYPE_DISPLAY_MAP[type] ?? {
    label: type,
    icon: '',
    description: '',
  };
}

// ===== 状态效果 =====

export interface StatusEffectDisplayInfo {
  label: string;
  icon: string;
  description: string;
}

export const STATUS_EFFECT_DISPLAY_MAP: Record<
  StatusEffect,
  StatusEffectDisplayInfo
> = {
  burn: {
    label: '灼烧',
    icon: '🔥',
    description: '业火缠身，每回合损失气血',
  },
  bleed: {
    label: '流血',
    icon: '🩸',
    description: '伤口难愈，随时间流失气血',
  },
  poison: {
    label: '中毒',
    icon: '☠️',
    description: '剧毒入骨，气血与灵力缓慢流逝',
  },
  stun: {
    label: '眩晕',
    icon: '🌀',
    description: '元神震荡，暂时无法行动',
  },
  silence: {
    label: '沉默',
    icon: '🤐',
    description: '法咒受限，无法施展部分神通',
  },
  root: {
    label: '定身',
    icon: '🔒',
    description: '身形被禁锢，难以移动与闪避',
  },
  armor_up: {
    label: '护体',
    icon: '🛡️',
    description: '护体罡气环绕，大幅减免伤害',
  },
  speed_up: {
    label: '疾速',
    icon: '🏃‍♂️',
    description: '身形如电，出手与闪避皆获加成',
  },
  crit_rate_up: {
    label: '会心',
    icon: '🎯',
    description: '战意如虹，暴击几率大幅提升',
  },
  armor_down: {
    label: '破防',
    icon: '💔',
    description: '护体被破，所受伤害显著增加',
  },
};

export function getStatusLabel(effect: StatusEffect): string {
  return STATUS_EFFECT_DISPLAY_MAP[effect]?.label ?? effect;
}


export function getStatusEffectInfo(effect: StatusEffect): StatusEffectDisplayInfo {
  return STATUS_EFFECT_DISPLAY_MAP[effect] ?? {
    label: effect,
    icon: '',
    description: '',
  };
}


// ===== 装备槽位与类型 =====

export interface EquipmentSlotDisplayInfo {
  label: string;
  artifactTypeLabel: string;
}

export const EQUIPMENT_SLOT_DISPLAY_MAP: Record<
  EquipmentSlot,
  EquipmentSlotDisplayInfo
> = {
  weapon: {
    label: '武器',
    artifactTypeLabel: '道器',
  },
  armor: {
    label: '护甲',
    artifactTypeLabel: '灵器',
  },
  accessory: {
    label: '饰品',
    artifactTypeLabel: '宝器',
  },
};

export function getEquipmentSlotLabel(slot: EquipmentSlot): string {
  return EQUIPMENT_SLOT_DISPLAY_MAP[slot]?.label ?? slot;
}

export function getArtifactTypeLabel(slot: EquipmentSlot): string {
  return EQUIPMENT_SLOT_DISPLAY_MAP[slot]?.artifactTypeLabel ?? '法宝';
}

// ===== 消耗品类型 =====

export interface ConsumableTypeDisplayInfo {
  label: string;
  description: string;
}

export const CONSUMABLE_TYPE_DISPLAY_MAP: Record<
  ConsumableType,
  ConsumableTypeDisplayInfo
> = {
  heal: {
    label: '疗伤丹',
    description: '回复气血的丹药或灵物',
  },
  buff: {
    label: '增益丹',
    description: '短时间内提升某项能力的秘药',
  },
  revive: {
    label: '续命丹',
    description: '在重创之时挽回一线生机',
  },
  breakthrough: {
    label: '破境丹',
    description: '助力闭关突破境界的灵丹',
  },
};

export function getConsumableTypeLabel(type: ConsumableType): string {
  return CONSUMABLE_TYPE_DISPLAY_MAP[type]?.label ?? type;
}

// ===== 一些高层封装工具（便于前端使用） =====

export function formatAttributeBonusMap(
  bonus: Artifact['bonus'] | Skill['power'] | Record<string, unknown>,
): string {
  if (!bonus || typeof bonus !== 'object') return '';
  const entries = Object.entries(bonus as Record<string, unknown>).filter(
    ([, v]) => typeof v === 'number' && v !== 0,
  ) as [AttributeKey, number][];
  if (!entries.length) return '';
  return entries
    .map(([key, value]) => {
      const label = getAttributeLabel(key);
      const sign = value > 0 ? '+' : '';
      return `${label} ${sign}${value}`;
    })
    .join('｜');
}


