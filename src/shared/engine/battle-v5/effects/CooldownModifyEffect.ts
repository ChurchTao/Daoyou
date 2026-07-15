import { ActiveSkill } from '../abilities/ActiveSkill';
import { CooldownModifyParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { CooldownModifyEvent } from '../core/events';
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
    const recipient = this.params.target === 'caster' ? caster : target;
    const abilities = recipient.abilities.getAllAbilities();
    const matchedSkills = abilities.filter(
      (skill): skill is ActiveSkill =>
        skill instanceof ActiveSkill &&
        (this.params.includeCurrent || ability !== skill) &&
        (!this.params.tags || skill.tags.hasAnyTag(this.params.tags)),
    );
    const countToModify =
      this.params.maxCount === undefined
        ? matchedSkills.length
        : Math.min(
            matchedSkills.length,
            Math.max(0, Math.floor(this.params.maxCount)),
          );

    for (let i = 0; i < countToModify; i++) {
      const skill = matchedSkills[i];

      // 调用 ActiveSkill 提供的标准化方法修改冷却
      skill.modifyCooldown(this.params.cdModifyValue);

      // 发布冷却修改事件
      EventBus.instance.publish<CooldownModifyEvent>({
        type: 'CooldownModifyEvent',
        timestamp: Date.now(),
        caster,
        target: recipient,
        ability,
        cdModifyValue: this.params.cdModifyValue,
        affectedAbilityName: skill.name,
      });
    }
  }
}

// 注册
EffectRegistry.getInstance().register(
  'cooldown_modify',
  (params) => new CooldownModifyEffect(params),
);
