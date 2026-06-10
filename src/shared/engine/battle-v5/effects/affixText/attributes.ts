/**
 * 属性 → 中文标签的唯一字典。
 *
 * 所有面向玩家的文案（词缀渲染、战报、UI）都应从这里引用，避免在多处重复定义。
 */
import { getResourceText } from '@shared/lib/gameConceptDisplay';
import {
  getGameConceptLabel,
  getGameConceptVariantLabel,
} from '@shared/lib/gameConceptDisplay';
import { AttributeType } from '../../core/types';

export const ATTR_LABELS: Record<AttributeType, string> = {
  [AttributeType.SPIRIT]: getGameConceptLabel('spirit'),
  [AttributeType.VITALITY]: getGameConceptLabel('vitality'),
  [AttributeType.SPEED]: getGameConceptLabel('speed'),
  [AttributeType.WILLPOWER]: getGameConceptLabel('willpower'),
  [AttributeType.WISDOM]: getGameConceptLabel('wisdom'),
  [AttributeType.ATK]: getGameConceptVariantLabel('attribute_atk', 'short'),
  [AttributeType.DEF]: getGameConceptVariantLabel('attribute_def', 'short'),
  [AttributeType.MAGIC_ATK]: getGameConceptVariantLabel(
    'attribute_magic_atk',
    'short',
  ),
  [AttributeType.MAGIC_DEF]: getGameConceptVariantLabel(
    'attribute_magic_def',
    'short',
  ),
  [AttributeType.CRIT_RATE]: getGameConceptLabel('attribute_crit_rate'),
  [AttributeType.CRIT_DAMAGE_MULT]: getGameConceptLabel(
    'attribute_crit_damage',
  ),
  [AttributeType.EVASION_RATE]: getGameConceptLabel('attribute_evasion_rate'),
  [AttributeType.CONTROL_HIT]: getGameConceptLabel('attribute_control_hit'),
  [AttributeType.CONTROL_RESISTANCE]: getGameConceptLabel(
    'attribute_control_resistance',
  ),
  [AttributeType.MAX_HP]: getResourceText('maxHp'),
  [AttributeType.MAX_MP]: getResourceText('maxMp'),
  [AttributeType.ARMOR_PENETRATION]: getGameConceptLabel(
    'attribute_armor_penetration',
  ),
  [AttributeType.MAGIC_PENETRATION]: getGameConceptVariantLabel(
    'attribute_magic_penetration',
    'compact',
  ),
  [AttributeType.CRIT_RESIST]: getGameConceptLabel('attribute_crit_resist'),
  [AttributeType.CRIT_DAMAGE_REDUCTION]: getGameConceptLabel(
    'attribute_crit_damage_reduction',
  ),
  [AttributeType.ACCURACY]: getGameConceptLabel('attribute_accuracy'),
  [AttributeType.HEAL_AMPLIFY]: getGameConceptLabel('attribute_heal_amplify'),
};

export function attrLabel(attrType: AttributeType): string {
  return ATTR_LABELS[attrType] ?? attrType;
}
