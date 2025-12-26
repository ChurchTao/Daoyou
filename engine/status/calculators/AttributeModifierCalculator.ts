import type {
  AttributeModification,
  CalculationContext,
  EffectCalculator,
  StatusInstance,
} from '../types';

/**
 * 属性修正计算器
 * 负责计算状态对角色属性的影响
 */
export class AttributeModifierCalculator implements EffectCalculator {
  calculateAttributeModification(
    status: StatusInstance,
    context: CalculationContext,
  ): Partial<AttributeModification> {
    const modification: Partial<AttributeModification> = {};

    switch (status.statusKey) {
      // ===== Buff类 =====
      case 'armor_up':
        modification.vitality = context.target.baseAttributes.vitality * 0.15;
        break;

      case 'speed_up':
        modification.speed = 20;
        break;

      case 'crit_rate_up':
        modification.wisdom = context.target.baseAttributes.wisdom * 0.15;
        break;

      // ===== Debuff类 =====
      case 'armor_down':
        modification.vitality = context.target.baseAttributes.vitality * -0.15;
        break;

      case 'crit_rate_down':
        modification.wisdom = context.target.baseAttributes.wisdom * -0.15;
        break;

      // ===== 持久状态 =====

      // weakness: 全属性降低10%
      case 'weakness':
        {
          const penalty = status.potency / 100; // potency为百分比
          modification.vitality =
            context.target.baseAttributes.vitality * -penalty;
          modification.spirit = context.target.baseAttributes.spirit * -penalty;
          modification.wisdom = context.target.baseAttributes.wisdom * -penalty;
          modification.speed = context.target.baseAttributes.speed * -penalty;
          modification.willpower =
            context.target.baseAttributes.willpower * -penalty;
        }
        break;

      // minor_wound: 最大气血降低10%
      case 'minor_wound':
        {
          const penalty = status.potency / 100;
          modification.maxHp = context.target.maxHp * -penalty;
        }
        break;

      // major_wound: 最大气血降低30%
      case 'major_wound':
        {
          const penalty = status.potency / 100;
          modification.maxHp = context.target.maxHp * -penalty;
        }
        break;

      // near_death: 全属性与气血降低50%
      case 'near_death':
        {
          const penalty = status.potency / 100;
          modification.vitality =
            context.target.baseAttributes.vitality * -penalty;
          modification.spirit = context.target.baseAttributes.spirit * -penalty;
          modification.wisdom = context.target.baseAttributes.wisdom * -penalty;
          modification.speed = context.target.baseAttributes.speed * -penalty;
          modification.willpower =
            context.target.baseAttributes.willpower * -penalty;
          modification.maxHp = context.target.maxHp * -penalty;
        }
        break;

      // mana_depleted: 最大灵力降低20%
      case 'mana_depleted':
        {
          const penalty = status.potency / 100;
          modification.maxMp = context.target.maxMp * -penalty;
        }
        break;

      // hp_deficit: 治疗效果降低30%
      case 'hp_deficit':
        {
          const penalty = status.potency / 100;
          modification.healingEffectiveness = -penalty * 100; // 转换为百分比
        }
        break;

      // enlightenment: 悟性大幅提升50%
      case 'enlightenment':
        {
          const bonus = status.potency / 100;
          modification.wisdom = context.target.baseAttributes.wisdom * bonus;
        }
        break;

      // willpower_enhanced: 神识提升30%
      case 'willpower_enhanced':
        {
          const bonus = status.potency / 100;
          modification.willpower =
            context.target.baseAttributes.willpower * bonus;
        }
        break;

      // fate_blessing: 全属性小幅提升10%
      case 'fate_blessing':
        {
          const bonus = status.potency / 100;
          modification.vitality =
            context.target.baseAttributes.vitality * bonus;
          modification.spirit = context.target.baseAttributes.spirit * bonus;
          modification.wisdom = context.target.baseAttributes.wisdom * bonus;
          modification.speed = context.target.baseAttributes.speed * bonus;
          modification.willpower =
            context.target.baseAttributes.willpower * bonus;
        }
        break;

      // ===== 环境状态 =====

      // scorching: 火元素伤害+20%, 水元素伤害-20%
      case 'scorching':
        {
          const bonus = status.potency / 100;
          modification.elementDamageMultiplier = {
            火: 1 + bonus,
            水: 1 - bonus,
          };
        }
        break;

      // freezing: 冰元素伤害+20%, 火元素伤害-20%
      case 'freezing':
        {
          const bonus = status.potency / 100;
          modification.elementDamageMultiplier = {
            冰: 1 + bonus,
            火: 1 - bonus,
          };
        }
        break;

      // formation_suppressed: 全属性降低20%
      case 'formation_suppressed':
        {
          const penalty = status.potency / 100;
          modification.vitality =
            context.target.baseAttributes.vitality * -penalty;
          modification.spirit = context.target.baseAttributes.spirit * -penalty;
          modification.wisdom = context.target.baseAttributes.wisdom * -penalty;
          modification.speed = context.target.baseAttributes.speed * -penalty;
          modification.willpower =
            context.target.baseAttributes.willpower * -penalty;
        }
        break;

      // abundant_qi: 灵力恢复+50%
      case 'abundant_qi':
        {
          const bonus = status.potency / 100;
          modification.mpRecoveryMultiplier = bonus * 100; // 转换为百分比
        }
        break;

      default:
        // 其他状态不影响属性
        break;
    }

    return modification;
  }
}

export const attributeModifierCalculator = new AttributeModifierCalculator();
