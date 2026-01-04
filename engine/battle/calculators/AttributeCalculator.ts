import type { Attributes, Cultivator } from '@/types/cultivator';
import { calculateFinalAttributes as calcFinalAttrs } from '@/utils/cultivatorUtils';

/**
 * 属性计算器
 * 负责计算战斗单元的最终属性
 */
export class AttributeCalculator {
  /**
   * 获取基础属性 + 装备加成（不含状态）
   */
  getBaseWithEquipment(cultivatorData: Cultivator): Attributes {
    return calcFinalAttrs(cultivatorData).final;
  }

  /**
   * 应用修正到属性
   */
  applyModifications(
    baseAttributes: Attributes,
    modifications: Partial<Attributes>,
  ): Attributes {
    return {
      vitality: baseAttributes.vitality + (modifications.vitality ?? 0),
      spirit: baseAttributes.spirit + (modifications.spirit ?? 0),
      wisdom: baseAttributes.wisdom + (modifications.wisdom ?? 0),
      speed: baseAttributes.speed + (modifications.speed ?? 0),
      willpower: baseAttributes.willpower + (modifications.willpower ?? 0),
    };
  }
}

export const attributeCalculator = new AttributeCalculator();
