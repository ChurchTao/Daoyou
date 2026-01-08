import type { BuffEvent } from '@/engine/buff/types';
import { effectEngine } from '@/engine/effect';
import { EffectTrigger, EffectType } from '@/engine/effect/types';
import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from './BattleUnit';
import { DamagePipeline, EffectPipeline, HealPipeline } from './pipeline';

// ============================================================
// 类型定义
// ============================================================

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
 * 技能类型分类
 */
enum SkillCategory {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  BUFF = 'BUFF',
  MIXED = 'MIXED',
}

// ============================================================
// 技能执行器 v4 - 纯编排器
// ============================================================

/**
 * 技能执行器 v4
 *
 * 设计原则：
 * - 纯编排器，不包含任何效果处理逻辑
 * - 所有效果处理委托给对应的 Pipeline
 * - 只负责：判断技能类型 → 调用管道 → 收集结果
 *
 * 管道类型：
 * - DamagePipeline: 处理伤害效果
 * - HealPipeline: 处理治疗效果
 * - EffectPipeline: 处理其他效果 (Buff/真实伤害/法力吸取等)
 */
export class SkillExecutor {
  /**
   * 执行技能
   */
  execute(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    currentTurn: number,
  ): SkillExecutionResult {
    const result = this.createEmptyResult();
    const appliesToSelf = skill.target_self === true;
    const effectTarget = appliesToSelf ? caster : target;

    // 1. 分析技能类型
    const category = this.categorizeSkill(skill);

    // 2. 闪避判定（仅对伤害类技能）
    if (
      category === SkillCategory.DAMAGE &&
      this.checkEvasion(caster, target)
    ) {
      return this.handleEvasion(caster, target, skill, result);
    }

    // 3. 按类型分发到对应管道
    this.dispatchToPipelines(caster, effectTarget, skill, currentTurn, result);

    // 4. 确保有技能使用日志
    this.ensureSkillUsageLog(caster, skill, result);

    // 5. 消耗资源
    this.consumeResources(caster, skill, result);

    result.success = true;
    return result;
  }

  // ============================================================
  // 技能分类
  // ============================================================

  /**
   * 分析技能类型
   */
  private categorizeSkill(skill: Skill): SkillCategory {
    const effects = skill.effects ?? [];

    // TrueDamage 也被视为伤害类型（向后兼容）
    const hasDamage = effects.some(
      (e) => e.type === EffectType.Damage || e.type === EffectType.TrueDamage,
    );
    const hasHeal = effects.some((e) => e.type === EffectType.Heal);

    if (hasDamage && hasHeal) return SkillCategory.MIXED;
    if (hasDamage) return SkillCategory.DAMAGE;
    if (hasHeal) return SkillCategory.HEAL;
    return SkillCategory.BUFF;
  }

  // ============================================================
  // 管道分发
  // ============================================================

  /**
   * 将技能效果分发到对应管道处理
   */
  private dispatchToPipelines(
    caster: BattleUnit,
    effectTarget: BattleUnit,
    skill: Skill,
    currentTurn: number,
    result: SkillExecutionResult,
  ): void {
    const effects = skill.effects ?? [];

    for (const effectConfig of effects) {
      // 跳过非主动触发的效果
      const trigger = effectConfig.trigger ?? EffectTrigger.ON_SKILL_HIT;
      if (trigger !== EffectTrigger.ON_SKILL_HIT) {
        continue;
      }

      // 根据效果类型分发
      switch (effectConfig.type) {
        case EffectType.Damage:
        case EffectType.TrueDamage: {
          // TrueDamage 在 EffectFactory 中已映射为 DamageEffect
          const pipelineResult = DamagePipeline.executeForSkill(
            caster,
            effectTarget,
            skill,
            currentTurn,
          );
          this.mergeResult(result, pipelineResult);
          break;
        }

        case EffectType.Heal: {
          const pipelineResult = HealPipeline.executeForSkill(
            caster,
            effectTarget,
            skill,
            currentTurn,
          );
          this.mergeResult(result, pipelineResult);
          break;
        }

        default: {
          // 其他效果 (AddBuff, ManaDrain, Dispel 等)
          const pipelineResult = EffectPipeline.executeForEffect(
            caster,
            effectTarget,
            skill,
            effectConfig,
            currentTurn,
          );
          this.mergeResult(result, pipelineResult);
          break;
        }
      }
    }
  }

  // ============================================================
  // 结果合并
  // ============================================================

  /**
   * 合并管道执行结果
   */
  private mergeResult(
    result: SkillExecutionResult,
    pipelineResult: {
      evaded: boolean;
      actualDamage: number;
      isCritical: boolean;
      healing?: number;
      logs: string[];
    },
  ): void {
    if (pipelineResult.evaded) {
      result.evaded = true;
    }
    result.damage += pipelineResult.actualDamage;
    result.healing += pipelineResult.healing ?? 0;
    result.isCritical = result.isCritical || pipelineResult.isCritical;
    result.logs.push(...pipelineResult.logs);
  }

  // ============================================================
  // 闪避处理
  // ============================================================

  /**
   * 检查闪避
   */
  private checkEvasion(attacker: BattleUnit, defender: BattleUnit): boolean {
    const cannotDodge = defender.hasBuff('stun') || defender.hasBuff('root');
    if (cannotDodge) return false;

    const baseHitRate = 1.0;
    const finalHitRate = effectEngine.process(
      EffectTrigger.ON_CALC_HIT_RATE,
      attacker,
      defender,
      baseHitRate,
    );

    return Math.random() > finalHitRate;
  }

  /**
   * 处理闪避结果
   */
  private handleEvasion(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): SkillExecutionResult {
    result.evaded = true;
    result.success = true;
    result.logs.push(
      `${target.getName()} 闪避了 ${caster.getName()} 的「${skill.name}」！`,
    );

    // 触发闪避事件
    effectEngine.process(EffectTrigger.ON_DODGE, caster, target, 0);

    // 消耗资源
    this.consumeResources(caster, skill, result);

    return result;
  }

  // ============================================================
  // 资源消耗
  // ============================================================

  /**
   * 消耗 MP 和设置冷却
   */
  private consumeResources(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    const mpCost = skill.cost ?? 0;
    if (mpCost > 0) {
      caster.consumeMp(mpCost);
      result.mpCost = mpCost;
    }
    caster.setCooldown(skill.id!, skill.cooldown);
  }

  // ============================================================
  // 日志补充
  // ============================================================

  /**
   * 确保有技能使用日志
   */
  private ensureSkillUsageLog(
    caster: BattleUnit,
    skill: Skill,
    result: SkillExecutionResult,
  ): void {
    const effects = skill.effects ?? [];

    // 伤害和治疗效果会自动生成日志
    const hasAutoLog = effects.some(
      (e) => e.type === EffectType.Damage || e.type === EffectType.Heal,
    );

    if (result.logs.length === 0) {
      result.logs.push(`${caster.getName()} 使用「${skill.name}」`);
    } else if (!hasAutoLog) {
      result.logs.unshift(`${caster.getName()} 使用「${skill.name}」`);
    }
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 创建空的执行结果
   */
  private createEmptyResult(): SkillExecutionResult {
    return {
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
  }
}

export const skillExecutor = new SkillExecutor();
