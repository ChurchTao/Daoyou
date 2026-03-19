import { GameplayTags } from '../../core/GameplayTags';
import {
  AttributeModifier,
  AttributeType,
  BuffId,
  BuffType,
  ModifierType,
} from '../../core/types';
import { Buff, StackRule } from '../Buff';

/**
 * 力量提升 - 示例 Buff
 * 增加 10 点体魄，持续 3 回合
 */
export class StrengthBuff extends Buff {
  private modifierId: string = 'strength_buff_modifier';

  constructor() {
    super(
      'strength_buff' as BuffId,
      '力量提升',
      BuffType.BUFF,
      3,
      StackRule.REFRESH_DURATION, // 使用导入的 StackRule
    );

    // 设置标签
    this.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);
  }

  onActivate(): void {
    // 添加属性修改器
    const modifier: AttributeModifier = {
      id: this.modifierId,
      attrType: AttributeType.PHYSIQUE,
      type: ModifierType.FIXED,
      value: 10,
      source: this,
    };
    this._owner?.attributes.addModifier(modifier);
  }

  onDeactivate(): void {
    // 移除属性修改器
    this._owner?.attributes.removeModifier(this.modifierId);
  }

  /**
   * 克隆 Buff，保留当前持续时间状态
   * 生命周期钩子会在 Buff 添加到 Unit 时重新设置
   */
  clone(): StrengthBuff {
    const currentDuration = this.getDuration();
    const maxDuration = this.getMaxDuration();

    const cloned = new StrengthBuff();

    // 调整持续时间到当前状态
    // 需要从最大持续时间 tick 到当前持续时间
    const ticksNeeded = maxDuration - currentDuration;
    for (let i = 0; i < ticksNeeded; i++) {
      cloned.tickDuration();
    }

    return cloned;
  }
}
