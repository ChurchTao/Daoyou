import { Buff } from '../Buff';
import { BuffId, BuffType, AttributeType, ModifierType, AttributeModifier } from '../../core/types';
import { Unit } from '../../units/Unit';

/**
 * 力量提升 - 示例 Buff
 * 增加 10 点体魄，持续 3 回合
 */
export class StrengthBuff extends Buff {
  private modifierId: string = 'strength_buff_modifier';

  constructor() {
    super('strength_buff' as BuffId, '力量提升', BuffType.BUFF, 3);

    // 设置生命周期钩子
    this.onApply = (unit: Unit) => {
      // 添加属性修改器
      const modifier: AttributeModifier = {
        id: this.modifierId,
        attrType: AttributeType.PHYSIQUE,
        type: ModifierType.FIXED,
        value: 10,
        source: this,
      };
      unit.attributes.addModifier(modifier);
    };

    this.onRemove = (unit: Unit) => {
      // 移除属性修改器
      unit.attributes.removeModifier(this.modifierId);
    };
  }
}
