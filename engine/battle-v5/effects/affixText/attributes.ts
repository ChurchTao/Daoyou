/**
 * 属性 → 中文标签的唯一字典。
 *
 * 所有面向玩家的文案（词缀渲染、战报、UI）都应从这里引用，避免在多处重复定义。
 */
import { AttributeType } from '../../core/types';

export const ATTR_LABELS: Record<AttributeType, string> = {
  [AttributeType.SPIRIT]: '灵力',
  [AttributeType.VITALITY]: '体魄',
  [AttributeType.SPEED]: '身法',
  [AttributeType.WILLPOWER]: '神识',
  [AttributeType.WISDOM]: '悟性',
  [AttributeType.ATK]: '物攻',
  [AttributeType.DEF]: '物防',
  [AttributeType.MAGIC_ATK]: '法攻',
  [AttributeType.MAGIC_DEF]: '法防',
  [AttributeType.CRIT_RATE]: '暴击率',
  [AttributeType.CRIT_DAMAGE_MULT]: '暴击伤害',
  [AttributeType.EVASION_RATE]: '闪避率',
  [AttributeType.CONTROL_HIT]: '控制命中',
  [AttributeType.CONTROL_RESISTANCE]: '控制抗性',
  [AttributeType.ARMOR_PENETRATION]: '破防',
  [AttributeType.MAGIC_PENETRATION]: '法穿',
  [AttributeType.CRIT_RESIST]: '暴击抗性',
  [AttributeType.CRIT_DAMAGE_REDUCTION]: '暴伤减免',
  [AttributeType.ACCURACY]: '命中',
  [AttributeType.HEAL_AMPLIFY]: '治疗加成',
};

export function attrLabel(attrType: AttributeType): string {
  return ATTR_LABELS[attrType] ?? attrType;
}
