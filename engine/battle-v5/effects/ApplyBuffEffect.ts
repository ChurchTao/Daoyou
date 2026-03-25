import { GameplayEffect, EffectContext } from './Effect';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ApplyBuffParams } from '../core/configs';
import { BuffFactory } from '../factories/BuffFactory';

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
    target.buffs.addBuff(buff, caster);
  }
}

// 注册
EffectRegistry.getInstance().register('apply_buff', (params) => new ApplyBuffEffect(params));
