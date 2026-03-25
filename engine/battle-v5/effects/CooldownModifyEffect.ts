import { GameplayEffect, EffectContext } from './Effect';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { EffectRegistry } from '../factories/EffectRegistry';
import { CooldownModifyParams } from '../core/configs';

/**
 * 冷却修改原子效果
 * 扰动技能的时序逻辑
 */
export class CooldownModifyEffect extends GameplayEffect {
  constructor(private params: CooldownModifyParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target } = context;
    const abilities = target.abilities.getAllAbilities();

    for (const ability of abilities) {
      if (ability instanceof ActiveSkill) {
        // 如果指定了技能标识符
        if (this.params.abilitySlug && ability.id !== this.params.abilitySlug) {
          continue;
        }

        // 调用 ActiveSkill 提供的标准化方法修改冷却
        ability.modifyCooldown(this.params.cdModifyValue);
      }
    }
  }
}

// 注册
EffectRegistry.getInstance().register('cooldown_modify', (params) => new CooldownModifyEffect(params));
