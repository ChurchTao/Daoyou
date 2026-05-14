import { Unit } from '../units/Unit';
import { AttributeType, UnitId } from '../core/types';

/**
 * 现有 Cultivator 数据模型（简化）
 */
export interface CultivatorData {
  id: string;
  name: string;
  attributes: {
    spirit: number;
    vitality: number;
    speed: number;
    wisdom: number;
    willpower: number;
  };
}

/**
 * 数据适配器
 * 将现有 Cultivator 数据模型转换为 V5 Unit
 */
export class CultivatorAdapter {
  /**
   * 属性映射表
   */
  private static readonly ATTRIBUTE_MAP = {
    spirit: AttributeType.SPIRIT,
    vitality: AttributeType.VITALITY,
    speed: AttributeType.SPEED,
    wisdom: AttributeType.WISDOM,
    willpower: AttributeType.WILLPOWER,
  } as const;

  /**
   * Cultivator → Unit
   */
  static toUnit(data: CultivatorData, isMirror: boolean = false): Unit {
    const baseAttrs: Partial<Record<AttributeType, number>> = {};

    // 映射属性
    for (const [cultivatorKey, v5Key] of Object.entries(this.ATTRIBUTE_MAP)) {
      baseAttrs[v5Key] = data.attributes[cultivatorKey as keyof typeof data.attributes];
    }

    const unitId = (data.id + (isMirror ? '_mirror' : '')) as UnitId;
    const name = isMirror ? `${data.name}的镜像` : data.name;

    return new Unit(unitId, name, baseAttrs);
  }

  /**
   * 批量转换
   */
  static toUnits(dataList: CultivatorData[], isMirror: boolean = false): Unit[] {
    return dataList.map((data) => this.toUnit(data, isMirror));
  }
}
