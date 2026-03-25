import { AttributeType } from '../core';
import { TagTriggerParams } from '../core/configs';
import { EffectRegistry } from '../factories/EffectRegistry';
import { DamageEffect } from './DamageEffect';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 标签触发原子效果
 * 检查目标是否有指定标签，如果有则执行后续逻辑
 */
export class TagTriggerEffect extends GameplayEffect {
  constructor(private params: TagTriggerParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target } = context;

    // 1. 检查目标是否拥有该标签
    if (!target.tags.hasTag(this.params.triggerTag)) {
      return;
    }

    // 2. 如果拥有，则触发逻辑
    const damageEffect = new DamageEffect({
      value: {
        base: 50,
        coefficient: this.params.damageRatio || 2.0,
        attribute: AttributeType.SPIRIT,
      },
    });
    damageEffect.execute(context);

    // 3. 处理后续动作：移除对应 Buff
    if (this.params.removeOnTrigger) {
      const buffs = target.buffs.getAllBuffs();
      const targetBuff = buffs.find((b) =>
        b.tags.hasTag(this.params.triggerTag),
      );
      if (targetBuff) {
        target.buffs.removeBuff(targetBuff.id);
      }
    }
  }
}

// 注册
EffectRegistry.getInstance().register(
  'tag_trigger',
  (params) => new TagTriggerEffect(params),
);
