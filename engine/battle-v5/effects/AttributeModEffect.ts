import { GameplayEffect, EffectContext } from './Effect';
import { EffectRegistry } from '../factories/EffectRegistry';
import { AttributeModParams } from '../core/configs';

/**
 * 属性修改原子效果
 * 用于即时修改单位属性，或作为 Buff 逻辑的一部分
 */
export class AttributeModEffect extends GameplayEffect {
  constructor(private params: AttributeModParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target } = context;

    if (this.params.isPermanent) {
      // 永久修改基础值
      const currentBase = target.attributes.getBaseValue(this.params.attrType);
      target.attributes.setBaseValue(this.params.attrType, currentBase + this.params.value);
    } else {
      // 添加临时修改器
      target.attributes.addModifier({
        id: `instant_mod_${this.params.attrType}_${Math.random().toString(36).substr(2, 5)}`,
        attrType: this.params.attrType,
        type: this.params.modType,
        value: this.params.value,
        source: context.ability || this,
      });
    }

    // 更新派生属性
    target.updateDerivedStats();
  }
}

// 注册
EffectRegistry.getInstance().register('attribute_mod', (params) => new AttributeModEffect(params));
