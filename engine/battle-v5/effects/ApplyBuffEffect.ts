import { BuffConfig } from '../core/configs';
import { BuffFactory } from '../factories/BuffFactory';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 添加 Buff 效果参数
 */
export interface ApplyBuffEffectParams {
  chance?: number; // 触发概率 (0-1)
  buffConfig: BuffConfig; // Buff 配置 JSON
}

/**
 * 添加 Buff 原子效果
 */
export class ApplyBuffEffect extends GameplayEffect {
  constructor(private params: ApplyBuffEffectParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target } = context;

    // 概率检查
    if (
      this.params.chance !== undefined &&
      Math.random() > this.params.chance
    ) {
      return;
    }

    // 通过 Buff 工厂创建一个全新的 Buff 实例
    // 这里支持完全自包含的 Buff 配置
    const buff = BuffFactory.create(this.params.buffConfig);

    // 应用 Buff
    target.buffs.addBuff(buff, caster);
  }
}
