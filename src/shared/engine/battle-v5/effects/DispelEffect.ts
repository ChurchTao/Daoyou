import { DispelParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { DispelEvent } from '../core/events';
import { BuffType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 驱散原子效果
 * 用于驱散正面或负面状态 (基于标签体系)
 */
export class DispelEffect extends GameplayEffect {
  constructor(private params: DispelParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { caster, ability } = context;
    const target = this.params.recipient === 'caster' ? caster : context.target;
    const buffs = target.buffs.getAllBuffs();

    // 过滤匹配标签的 Buff
    const matchBuffs = this.params.targetTag
      ? buffs.filter((b) => b.tags.hasTag(this.params.targetTag!))
      : buffs;
    const statusBuffs = this.params.status
      ? matchBuffs.filter((buff) =>
          this.params.status === 'positive'
            ? buff.type === BuffType.BUFF
            : buff.type === BuffType.DEBUFF || buff.type === BuffType.CONTROL,
        )
      : matchBuffs;
    const removableBuffs = statusBuffs.filter(
      (buff) => buff.dispelPolicy === 'normal',
    );

    if (removableBuffs.length === 0) {
      executeEffectConfigs(this.params.fallbackEffects ?? [], context);
      return;
    }

    // 确定移除数量
    const countToRemove = Math.min(
      removableBuffs.length,
      this.params.maxCount || 1,
    );
    const removedBuffNames: string[] = [];

    // 执行移除
    for (let i = 0; i < countToRemove; i++) {
      if (!context.canExecuteEffect()) break;
      if (
        target.buffs.removeBuffDispel(removableBuffs[i].id, {
          source: caster,
          ability,
          attribution: context.attribution,
          trace: context.trace,
        })
      ) {
        removedBuffNames.push(removableBuffs[i].name);
      }
    }

    if (!context.canExecuteEffect()) return;

    if (removedBuffNames.length === 0) {
      executeEffectConfigs(this.params.fallbackEffects ?? [], context);
      return;
    }

    // 发布驱散事件
    context.emit<DispelEvent>({
      type: 'DispelEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster,
      target,
      ability,
      removedBuffNames,
    });
    executeEffectConfigs(this.params.effects ?? [], context);
  }
}

// 注册
EffectRegistry.getInstance().register(
  'dispel',
  (params) => new DispelEffect(params),
);
