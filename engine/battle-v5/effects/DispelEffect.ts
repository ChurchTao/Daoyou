import { GameplayEffect, EffectContext } from './Effect';
import { EffectRegistry } from '../factories/EffectRegistry';
import { DispelParams } from '../core/configs';

/**
 * 驱散原子效果
 * 用于驱散正面或负面状态 (基于标签体系)
 */
export class DispelEffect extends GameplayEffect {
  constructor(private params: DispelParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target } = context;
    const buffs = target.buffs.getAllBuffs();

    // 过滤匹配标签的 Buff
    const matchBuffs = this.params.targetTag
      ? buffs.filter(b => b.tags.hasTag(this.params.targetTag!))
      : buffs;

    if (matchBuffs.length === 0) return;

    // 确定移除数量
    const countToRemove = Math.min(matchBuffs.length, this.params.maxCount || 1);

    // 执行移除
    for (let i = 0; i < countToRemove; i++) {
      target.buffs.removeBuff(matchBuffs[i].id);
    }
  }
}

// 注册
EffectRegistry.getInstance().register('dispel', (params) => new DispelEffect(params));
