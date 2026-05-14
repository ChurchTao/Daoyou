import { GameplayEffect, EffectContext } from './Effect';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ApplyBuffParams } from '../core/configs';
import { BuffFactory } from '../factories/BuffFactory';
import { AttributeType, BuffType } from '../core/types';

/**
 * 施加 Buff 原子效果
 */
export class ApplyBuffEffect extends GameplayEffect {
  constructor(private params: ApplyBuffParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target, caster } = context;

    // 概率检查
    if (this.params.chance !== undefined && Math.random() > this.params.chance) {
      return;
    }

    // 创建 Buff 实例并添加到目标
    const buff = BuffFactory.create(this.params.buffConfig);

    // 控制类 Buff：根据目标的矫健属性缩短持续时间
    // 矫健 = 0 表示无礦1，矫健 = 1.0 则持续时间半分。无限持续 (permanent) 不受影响。
    if (buff.type === BuffType.CONTROL && !buff.isPermanent()) {
      const controlResistance = target.attributes.getValue(AttributeType.CONTROL_RESISTANCE);
      if (controlResistance > 0) {
        const currentDuration = buff.getDuration();
        const adjustedDuration = Math.max(
          1,
          Math.round(currentDuration / (1 + controlResistance)),
        );
        buff.refreshToDuration(adjustedDuration);
      }
    }

    target.buffs.addBuff(buff, caster);
  }
}

// 注册
EffectRegistry.getInstance().register('apply_buff', (params) => new ApplyBuffEffect(params));
