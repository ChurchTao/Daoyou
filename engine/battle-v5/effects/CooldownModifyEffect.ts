import { ActiveSkill } from '../abilities/ActiveSkill';
import { CooldownModifyParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { CooldownModifyEvent, EventPriorityLevel } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 冷却修改原子效果
 * 扰动技能的时序逻辑
 */
export class CooldownModifyEffect extends GameplayEffect {
  constructor(private params: CooldownModifyParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target, caster, ability } = context;
    const abilities = target.abilities.getAllAbilities();

    for (const skill of abilities) {
      if (skill instanceof ActiveSkill && ability?.id != skill.id) {
        // 如果指定了技能标识符
        if (this.params.tags && skill.tags.hasAnyTag(this.params.tags)) {
          // 调用 ActiveSkill 提供的标准化方法修改冷却
          skill.modifyCooldown(this.params.cdModifyValue);

          // 发布冷却修改事件
          EventBus.instance.publish<CooldownModifyEvent>({
            type: 'CooldownModifyEvent',
            priority: EventPriorityLevel.POST_SETTLE,
            timestamp: Date.now(),
            caster,
            target,
            ability,
            cdModifyValue: this.params.cdModifyValue,
            affectedAbilityName: skill.name,
          });
        }
      }
    }
  }
}

// 注册
EffectRegistry.getInstance().register(
  'cooldown_modify',
  (params) => new CooldownModifyEffect(params),
);
