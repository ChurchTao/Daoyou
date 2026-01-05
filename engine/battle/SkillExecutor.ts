import { buffRegistry } from '@/engine/buff';
import type { BuffEvent } from '@/engine/buff/types';
import { EffectFactory, effectEngine } from '@/engine/effect';
import { EffectTrigger } from '@/engine/effect/types';
import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from './BattleUnit';

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
 * 使用 ON_BEFORE_DAMAGE 和 ON_AFTER_DAMAGE 钩子处理伤害修正
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
    const evaded = this.checkEvasion(caster, target);
    if (evaded) {
      result.evaded = true;
      result.logs.push(
        `${target.getName()} 闪避了 ${caster.getName()} 的「${skill.name}」！`,
      );
      // 触发 ON_DODGE 事件
      effectEngine.process(EffectTrigger.ON_DODGE, caster, target, 0);
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
          value: 0,
          metadata: {
            skillName: skill.name,
            skillElement: skill.element,
          },
        };

        // 执行效果获取基础值
        effect.apply(context);

        // 收集效果结果
        if (effectConfig.type === 'Damage') {
          // 使用伤害管道：ON_SKILL_HIT -> ON_BEFORE_DAMAGE -> 扣血 -> ON_AFTER_DAMAGE
          const baseDamage = context.value ?? 0;

          // 调用 ON_BEFORE_DAMAGE 处理暴击、减伤等
          const beforeDamageCtx = effectEngine.processWithContext(
            EffectTrigger.ON_BEFORE_DAMAGE,
            caster,
            effectTarget,
            baseDamage,
            {
              skillName: skill.name,
              skillElement: skill.element,
            },
          );

          const finalDamage = Math.max(
            0,
            Math.floor(beforeDamageCtx.value ?? 0),
          );
          const isCritical = beforeDamageCtx.metadata?.isCritical === true;

          if (finalDamage > 0) {
            // 应用伤害
            const actualDamage = effectTarget.applyDamage(finalDamage);
            result.damage += actualDamage;
            result.isCritical = result.isCritical || isCritical;

            // 生成日志
            const critText = isCritical ? '暴击！' : '';
            result.logs.push(
              `${caster.getName()} 对 ${effectTarget.getName()} 使用「${skill.name}」，${critText}造成 ${actualDamage} 点伤害。`,
            );

            // 调用 ON_AFTER_DAMAGE 处理吸血、反伤等
            const afterDamageCtx = effectEngine.processWithContext(
              EffectTrigger.ON_AFTER_DAMAGE,
              caster,
              effectTarget,
              0,
              {
                finalDamage: actualDamage,
                skillName: skill.name,
                skillElement: skill.element,
              },
            );

            // 处理吸血
            const lifeSteal = afterDamageCtx.metadata?.lifeSteal as
              | number
              | undefined;
            if (lifeSteal && lifeSteal > 0) {
              const healedAmount = caster.applyHealing(lifeSteal);
              if (healedAmount > 0) {
                result.logs.push(
                  `${caster.getName()} 吸取了 ${healedAmount} 点生命。`,
                );
              }
            }

            // 处理反伤
            const reflectDamage = afterDamageCtx.metadata?.reflectDamage as
              | number
              | undefined;
            if (reflectDamage && reflectDamage > 0) {
              const reflectedAmount = caster.applyDamage(reflectDamage);
              if (reflectedAmount > 0) {
                result.logs.push(
                  `${effectTarget.getName()} 反弹了 ${reflectedAmount} 点伤害！`,
                );
              }
            }
          }
        } else if (effectConfig.type === 'Heal') {
          const healValue = context.value ?? 0;
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

  /**
   * 检查闪避
   * 使用 ON_CALC_HIT_RATE 钩子让效果介入
   */
  private checkEvasion(attacker: BattleUnit, defender: BattleUnit): boolean {
    const cannotDodge = defender.hasBuff('stun') || defender.hasBuff('root');

    if (cannotDodge) return false;

    // 使用 EffectEngine 计算最终命中率
    const baseHitRate = 1.0; // 100% 基础命中
    const finalHitRate = effectEngine.process(
      EffectTrigger.ON_CALC_HIT_RATE,
      attacker,
      defender,
      baseHitRate,
    );

    // 综合判定：finalHitRate 低于随机数或闪避判定成功
    return Math.random() > finalHitRate;
  }
}

export const skillExecutor = new SkillExecutor();
