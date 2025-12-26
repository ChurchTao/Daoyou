import type { Attributes, Cultivator } from '@/types/cultivator';
import { calculateFinalAttributes as calcFinalAttrs } from '@/utils/cultivatorUtils';
import type { AttributeContext } from '../types';

/**
 * 属性计算器
 * 负责计算战斗单元的最终属性（基础+装备+状态修正）
 */
export class AttributeCalculator {
  /**
   * 计算最终属性
   * 
   * 流程：
   * 1. 获取基础属性+装备加成（通过 cultivatorUtils）
   * 2. 应用状态修正
   * 
   * @param context 属性计算上下文
   * @returns 最终属性
   */
  calculateFinalAttributes(context: AttributeContext): Attributes {
    const { cultivatorData, statusModifications } = context;

    // 获取基础属性+装备加成
    const baseWithEquipment = calcFinalAttrs(cultivatorData).final;

    // 应用状态修正
    const finalAttributes: Attributes = {
      vitality: baseWithEquipment.vitality + (statusModifications.vitality ?? 0),
      spirit: baseWithEquipment.spirit + (statusModifications.spirit ?? 0),
      wisdom: baseWithEquipment.wisdom + (statusModifications.wisdom ?? 0),
      speed: baseWithEquipment.speed + (statusModifications.speed ?? 0),
      willpower: baseWithEquipment.willpower + (statusModifications.willpower ?? 0),
    };

    return finalAttributes;
  }

  /**
   * 获取基础属性+装备加成（不含状态）
   * 
   * @param cultivatorData 修士数据
   * @returns 基础属性+装备加成
   */
  getBaseWithEquipment(cultivatorData: Cultivator): Attributes {
    return calcFinalAttrs(cultivatorData).final;
  }

  /**
   * 应用状态修正到属性
   * 
   * @param baseAttributes 基础属性
   * @param statusModifications 状态修正
   * @returns 应用修正后的属性
   */
  applyStatusModifications(
    baseAttributes: Attributes,
    statusModifications: Partial<Attributes>,
  ): Attributes {
    return {
      vitality: baseAttributes.vitality + (statusModifications.vitality ?? 0),
      spirit: baseAttributes.spirit + (statusModifications.spirit ?? 0),
      wisdom: baseAttributes.wisdom + (statusModifications.wisdom ?? 0),
      speed: baseAttributes.speed + (statusModifications.speed ?? 0),
      willpower: baseAttributes.willpower + (statusModifications.willpower ?? 0),
    };
  }
}

// 导出单例
export const attributeCalculator = new AttributeCalculator();
