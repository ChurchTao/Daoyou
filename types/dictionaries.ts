import type {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  MaterialType,
  Quality,
  SkillType,
  StatusEffect,
} from './constants';
import type { Attributes } from './cultivator';

// ===== 元素相关 =====

export interface ElementDisplayInfo {
  label: string;
  icon: string;
}

export const ELEMENT_DISPLAY_MAP: Record<ElementType, ElementDisplayInfo> = {
  金: {
    label: '金',
    icon: '⚔️',
  },
  木: {
    label: '木',
    icon: '🌿',
  },
  水: {
    label: '水',
    icon: '💧',
  },
  火: {
    label: '火',
    icon: '🔥',
  },
  土: {
    label: '土',
    icon: '⛰️',
  },
  风: {
    label: '风',
    icon: '🌪️',
  },
  雷: {
    label: '雷',
    icon: '⚡️️',
  },
  冰: {
    label: '冰',
    icon: '❄️',
  },
};

export function getElementInfo(key: ElementType): ElementDisplayInfo {
  return (
    ELEMENT_DISPLAY_MAP[key] ?? {
      label: key,
      icon: '',
    }
  );
}

// ===== 属性相关 =====

/**
 * 展示层用属性键：基础 5 维 + battle-v5 派生键。
 * Attributes 已被精简为仅保留基础 5 维，但 UI 显示仍需覆盖派生键，
 * 因此这里通过字面量并集扩展 keyof Attributes。
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
      description: '神魂坚韧程度，影响状态抗性、暴击伤害',
    },
    critRate: {
      label: '暴击率',
      icon: '🎯',
      shortLabel: '暴',
      description: '暴击几率',
    },
    critDamage: {
      label: '暴击伤害',
      icon: '💥',
      shortLabel: '暴伤',
      description: '暴击伤害',
    },
    damageReduction: {
      label: '伤害减免',
      icon: '🛡️',
      shortLabel: '减伤',
      description: '伤害减免',
    },
    flatDamageReduction: {
      label: '伤害减免',
      icon: '🛡️',
      shortLabel: '减伤',
      description: '伤害减免',
    },
    hitRate: {
      label: '命中率',
      icon: '🎯',
      shortLabel: '命',
      description: '命中率',
    },
    dodgeRate: {
      label: '闪避率',
      icon: '🏃‍♂️',
      shortLabel: '闪避',
      description: '闪避率',
    },
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
  return (
    SKILL_TYPE_DISPLAY_MAP[type] ?? {
      label: type,
      icon: '',
      description: '',
    }
  );
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
  crit_rate_down: {
    label: '暴击降低',
    icon: '💔',
    description: '暴击几率大幅降低',
  },
  // 持久状态
  weakness: {
    label: '虚弱',
    icon: '😰',
    description: '元气大伤，战力大幅下降',
  },
  minor_wound: {
    label: '轻伤',
    icon: '🩹',
    description: '身负轻伤，稍有影响',
  },
  major_wound: {
    label: '重伤',
    icon: '💥',
    description: '身负重伤，实力大损',
  },
  near_death: {
    label: '濒死',
    icon: '☠️',
    description: '命悬一线，随时可能陨落',
  },
  artifact_damaged: {
    label: '法宝受损',
    icon: '🔧',
    description: '法宝损坏，威力大减',
  },
  mana_depleted: {
    label: '灵力枯竭',
    icon: '💫',
    description: '灵力耗尽，难以施展术法',
  },
  hp_deficit: {
    label: '气血不足',
    icon: '🩸',
    description: '气血亏虚，行动受限',
  },
  enlightenment: {
    label: '顿悟',
    icon: '💡',
    description: '灵台清明，修炼事半功倍',
  },
  willpower_enhanced: {
    label: '意志增强',
    icon: '💪',
    description: '道心坚固，抗性提升',
  },
  fate_blessing: {
    label: '天命眷顾',
    icon: '🌟',
    description: '气运加身，诸事顺遂',
  },
  // 环境状态
  scorching: {
    label: '酷热',
    icon: '🌡️',
    description: '烈日当空，持续受到灼烧',
  },
  freezing: {
    label: '严寒',
    icon: '❄️',
    description: '天寒地冻，行动迟缓',
  },
  toxic_air: {
    label: '瘴气',
    icon: '☁️',
    description: '毒气弥漫，持续中毒',
  },
  formation_suppressed: {
    label: '阵法压制',
    icon: '⛓️',
    description: '被阵法压制，实力受限',
  },
  abundant_qi: {
    label: '灵气充沛',
    icon: '✨',
    description: '灵气浓郁，修炼速度提升',
  },
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

// ===== 装备槽位与类型 =====

export interface EquipmentSlotDisplayInfo {
  label: string;
  icon: string;
}

export const EQUIPMENT_SLOT_DISPLAY_MAP: Record<
  EquipmentSlot,
  EquipmentSlotDisplayInfo
> = {
  weapon: {
    label: '攻击法宝',
    icon: '🗡️',
  },
  armor: {
    label: '护身法宝',
    icon: '🛡️',
  },
  accessory: {
    label: '辅助法宝',
    icon: '💍',
  },
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

// ===== 消耗品类型 =====

export interface ConsumableTypeDisplayInfo {
  label: string;
  icon: string;
}

export const CONSUMABLE_TYPE_DISPLAY_MAP: Record<
  ConsumableType,
  ConsumableTypeDisplayInfo
> = {
  丹药: {
    label: '丹药',
    icon: '🌕',
  },
  符箓: {
    label: '符箓',
    icon: '📜',
  },
};

export function getConsumableTypeLabel(type: ConsumableType): string {
  return CONSUMABLE_TYPE_DISPLAY_MAP[type]?.label ?? type;
}

// 材料相关

export interface MaterialTypeDisplayInfo {
  label: string;
  icon: string;
}

export const MATERIAL_TYPE_DISPLAY_MAP: Record<
  MaterialType,
  MaterialTypeDisplayInfo
> = {
  herb: {
    label: '灵药',
    icon: '🌿',
  },
  ore: {
    label: '矿石',
    icon: '🪨',
  },
  monster: {
    label: '妖兽材料',
    icon: '🐉',
  },
  tcdb: {
    label: '天材地宝',
    icon: '💎',
  },
  aux: {
    label: '特殊辅料',
    icon: '💧',
  },
  gongfa_manual: {
    label: '功法典籍',
    icon: '📖',
  },
  skill_manual: {
    label: '神通秘术',
    icon: '📜',
  },
  manual: {
    label: '古旧典籍',
    icon: '📖',
  },
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

// ===== 资源与副本代价类型 =====

export interface ResourceTypeDisplayInfo {
  label: string;
  icon: string;
}

export const RESOURCE_TYPE_DISPLAY_MAP: Record<
  string,
  ResourceTypeDisplayInfo
> = {
  spirit_stones: { label: '灵石', icon: '💎' },
  lifespan: { label: '寿元', icon: '🕯️' },
  cultivation_exp: { label: '修为', icon: '🧘' },
  comprehension_insight: { label: '感悟', icon: '💡' },
  material: { label: '材料', icon: '📦' },
  artifact: { label: '法宝', icon: '⚔️' },
  consumable: { label: '消耗品', icon: '💊' },
  hp_loss: { label: '气血', icon: '🩸' },
  mp_loss: { label: '灵力', icon: '💧' },
  weak: { label: '虚弱', icon: '😰' },
  battle: { label: '战斗', icon: '⚔️' },
  artifact_damage: { label: '法宝受损', icon: '💔' },
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

// ===== 品质相关 =====

export interface QualityDisplayInfo {
  label: string;
  tier: string;
}

export const QUALITY_DISPLAY_MAP: Record<Quality, QualityDisplayInfo> = {
  凡品: { label: '凡品', tier: '凡品' },
  灵品: { label: '灵品', tier: '灵品' },
  玄品: { label: '玄品', tier: '玄品' },
  真品: { label: '真品', tier: '真品' },
  地品: { label: '地品', tier: '地品' },
  天品: { label: '天品', tier: '天品' },
  仙品: { label: '仙品', tier: '仙品' },
  神品: { label: '神品', tier: '神品' },
};

export function getQualityInfo(quality: Quality): QualityDisplayInfo {
  return (
    QUALITY_DISPLAY_MAP[quality] ?? {
      label: quality,
      tier: '凡品',
    }
  );
}

// 对于消耗品，使用与品质相同的显示
export function getConsumableRankInfo(quality: Quality): QualityDisplayInfo {
  return getQualityInfo(quality);
}
