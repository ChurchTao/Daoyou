import { DispelParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { DispelEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 驱散原子效果
 * 用于驱散正面或负面状态 (基于标签体系)
 */
export class DispelEffect extends GameplayEffect {
  constructor(private params: DispelParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target, caster, ability } = context;
    const buffs = target.buffs.getAllBuffs();

    // 过滤匹配标签的 Buff
    const matchBuffs = this.params.targetTag
      ? buffs.filter((b) => b.tags.hasTag(this.params.targetTag!))
      : buffs;

    if (matchBuffs.length === 0) return;

    // 确定移除数量
    const countToRemove = Math.min(
      matchBuffs.length,
      this.params.maxCount || 1,
    );
    const removedBuffNames: string[] = [];

    // 执行移除
    for (let i = 0; i < countToRemove; i++) {
      removedBuffNames.push(matchBuffs[i].name);
      target.buffs.removeBuff(matchBuffs[i].id);
    }

    // 发布驱散事件
    EventBus.instance.publish<DispelEvent>({
      type: 'DispelEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability,
      removedBuffNames,
    });
  }
}

// 注册
EffectRegistry.getInstance().register(
  'dispel',
  (params) => new DispelEffect(params),
);
