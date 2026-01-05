import { buffRegistry } from '@/engine/buff';
import type { BuffEvent } from '@/engine/buff/types';
import { EffectFactory } from '@/engine/effect';
import { EffectTrigger } from '@/engine/effect/types';
import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from './BattleUnit';
import { evasionCalculator } from './calculators/EvasionCalculator';

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean;
  evaded: boolean;
  damage: number;
  healing: number;
  isCritical: boolean;
  buffsApplied: BuffEvent[];
  logs: string[];
  mpCost: number;
  hpCost: number;
}

/**
 * 技能执行器 v2
 * 完全基于 EffectEngine 架构，遍历执行 skill.effects
 */
export class SkillExecutor {
  execute(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    _currentTurn: number,
  ): SkillExecutionResult {
    const result: SkillExecutionResult = {
      success: false,
      evaded: false,
      damage: 0,
      healing: 0,
      isCritical: false,
      buffsApplied: [],
      logs: [],
      mpCost: 0,
      hpCost: 0,
    };

    // 1. 闪避判定（仅对需要闪避的技能类型）
    const evaded = this.checkEvasion(target);
    if (evaded) {
      result.evaded = true;
      result.logs.push(
        `${target.getName()} 闪避了 ${caster.getName()} 的「${skill.name}」！`,
      );
      caster.setCooldown(skill.id!, skill.cooldown);
      return result;
    }

    // 2. 遍历执行技能效果
    const effects = skill.effects ?? [];
    const appliesToSelf = skill.target_self === true;
    const effectTarget = appliesToSelf ? caster : target;

    for (const effectConfig of effects) {
      try {
        const effect = EffectFactory.create(effectConfig);
        const context = {
          source: caster,
          target: effectTarget,
          trigger: EffectTrigger.ON_SKILL_HIT,
          metadata: {
            skillName: skill.name,
            skillElement: skill.element,
          },
        };

        const effectResult = effect.apply(context);

        // 收集效果结果
        if (effectConfig.type === 'Damage' && effectResult !== undefined) {
          const damageValue =
            typeof effectResult === 'number' ? effectResult : 0;
          const actualDamage = effectTarget.applyDamage(damageValue);
          result.damage += actualDamage;
          if (actualDamage > 0) {
            result.logs.push(
              `${caster.getName()} 对 ${effectTarget.getName()} 使用「${skill.name}」，造成 ${actualDamage} 点伤害。`,
            );
          }
        } else if (effectConfig.type === 'Heal' && effectResult !== undefined) {
          const healValue = typeof effectResult === 'number' ? effectResult : 0;
          const actualHeal = caster.applyHealing(healValue);
          result.healing += actualHeal;
          if (actualHeal > 0) {
            result.logs.push(
              `${caster.getName()} 使用「${skill.name}」，恢复 ${actualHeal} 点气血。`,
            );
          }
        } else if (effectConfig.type === 'AddBuff') {
          const params = effectConfig.params as
            | { buffId?: string; duration?: number }
            | undefined;
          if (params?.buffId) {
            const config = buffRegistry.get(params.buffId);
            if (config) {
              const event = effectTarget.buffManager.addBuff(config, caster, {
                durationOverride: params.duration,
              });
              result.buffsApplied.push(event);
              result.logs.push(
                `${effectTarget.getName()} 获得「${config.name}」状态。`,
              );
              effectTarget.markAttributesDirty();
            }
          }
        }
      } catch (err) {
        console.warn(`执行效果失败: ${effectConfig.type}`, err);
      }
    }

    // 如果没有任何效果，添加通用日志
    if (effects.length === 0 || result.logs.length === 0) {
      result.logs.push(`${caster.getName()} 使用「${skill.name}」。`);
    }

    // 3. 消耗 MP
    const mpCost = skill.cost ?? 0;
    if (mpCost > 0) {
      caster.consumeMp(mpCost);
      result.mpCost = mpCost;
    }

    // 4. 设置冷却
    caster.setCooldown(skill.id!, skill.cooldown);

    result.success = true;
    return result;
  }

  private checkEvasion(defender: BattleUnit): boolean {
    const defenderAttrs = defender.getFinalAttributes();
    const cannotDodge = defender.hasBuff('stun') || defender.hasBuff('root');

    return evasionCalculator.rollEvasion({
      attributes: defenderAttrs,
      cannotDodge,
    });
  }
}

export const skillExecutor = new SkillExecutor();
