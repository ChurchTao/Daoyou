import type { BuffEvent } from '@/engine/buff/types';
import { EffectFactory, effectEngine } from '@/engine/effect';
import type { BaseEffect } from '@/engine/effect/BaseEffect';
import {
  EffectContext,
  EffectLogCollector,
  EffectTrigger,
  EffectType,
} from '@/engine/effect/types';
import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from './BattleUnit';

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
 * 技能执行上下文
 * 包含技能执行过程中需要的所有数据
 */
interface SkillExecutionContext {
  caster: BattleUnit;
  target: BattleUnit;
  effectTarget: BattleUnit;
  skill: Skill;
  currentTurn: number;
  result: SkillExecutionResult;
  /** 缓存的技能 ON_BEFORE_DAMAGE 效果（避免重复创建） */
  cachedBeforeDamageEffects?: BaseEffect[];
  /** 缓存的技能 ON_AFTER_DAMAGE 效果（避免重复创建） */
  cachedAfterDamageEffects?: BaseEffect[];
}

// ============================================================
// 技能执行器
// ============================================================

/**
 * 技能执行器 v2
 *
 * 架构设计：
 * 1. 主流程 execute() 协调各阶段
 * 2. 每种效果类型有专门的处理方法
 * 3. 通用逻辑抽取为辅助方法
 *
 * 伤害管道：ON_SKILL_HIT -> ON_BEFORE_DAMAGE -> 扣血 -> ON_BEING_HIT -> ON_AFTER_DAMAGE
 */
export class SkillExecutor {
  // ============================================================
  // 主入口
  // ============================================================

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

    const ctx: SkillExecutionContext = {
      caster,
      target,
      effectTarget,
      skill,
      currentTurn,
      result,
    };

    // 阶段1: 闪避判定（仅对攻击性技能）
    if (this.shouldCheckEvasion(skill) && this.handleEvasion(ctx)) {
      return result;
    }

    // 阶段2: 执行技能效果
    this.executeEffects(ctx);

    // 阶段3: 补充技能使用日志（纯 Buff 技能）
    this.ensureSkillUsageLog(ctx);

    // 阶段4: 消耗 MP 和设置冷却
    this.consumeResources(ctx);

    result.success = true;
    return result;
  }

  // ============================================================
  // 阶段处理方法
  // ============================================================

  /**
   * 判断技能是否需要闪避判定
   * 自我增益/治疗技能不需要闪避判定
   */
  private shouldCheckEvasion(skill: Skill): boolean {
    // 自己对自己使用的技能不需要闪避
    if (skill.target_self) return false;

    // 没有伤害效果的技能不需要闪避（如纯增益 Buff）
    const hasDamageEffect = (skill.effects ?? []).some(
      (e) => e.type === EffectType.Damage,
    );
    return hasDamageEffect;
  }

  /**
   * 处理闪避判定
   * @returns true 如果被闪避
   */
  private handleEvasion(ctx: SkillExecutionContext): boolean {
    const { caster, target, skill, result } = ctx;

    const evaded = this.checkEvasion(caster, target);
    if (evaded) {
      result.evaded = true;
      result.success = true; // 【修复】技能确实被使用了，只是被闪避
      result.logs.push(
        `${target.getName()} 闪避了 ${caster.getName()} 的「${skill.name}」！`,
      );
      effectEngine.process(EffectTrigger.ON_DODGE, caster, target, 0);
      caster.setCooldown(skill.id!, skill.cooldown);

      // 【修复】闪避时也需要消耗 MP
      const mpCost = skill.cost ?? 0;
      if (mpCost > 0) {
        caster.consumeMp(mpCost);
        result.mpCost = mpCost;
      }

      return true;
    }
    return false;
  }

  /**
   * 执行技能的所有效果
   */
  private executeEffects(ctx: SkillExecutionContext): void {
    const { skill, caster } = ctx;
    const effects = skill.effects ?? [];

    // 预先缓存 ON_BEFORE_DAMAGE 效果（避免多次伤害时重复创建）
    ctx.cachedBeforeDamageEffects = this.collectSkillEffects(
      skill,
      EffectTrigger.ON_BEFORE_DAMAGE,
      caster,
    );

    // 预先缓存 ON_AFTER_DAMAGE 效果（避免多次伤害时重复创建）
    ctx.cachedAfterDamageEffects = this.collectSkillEffects(
      skill,
      EffectTrigger.ON_AFTER_DAMAGE,
      caster,
    );

    // 【修复】不再持久化 ON_BEING_HIT 效果到 temporarySkillEffects
    // 这些效果应该通过技能的 effects 配置在每次被攻击时动态触发
    // 避免重复触发的问题

    for (const effectConfig of effects) {
      try {
        this.executeSingleEffect(ctx, effectConfig);
      } catch (err) {
        console.warn(`执行效果失败: ${effectConfig.type}`, err);
      }
    }
  }

  /**
   * 执行单个效果
   */
  private executeSingleEffect(
    ctx: SkillExecutionContext,
    effectConfig: NonNullable<Skill['effects']>[number],
  ): void {
    const { caster, effectTarget, skill, result } = ctx;

    const trigger = effectConfig.trigger ?? EffectTrigger.ON_SKILL_HIT;

    // 跳过非主动触发的效果（如 ON_AFTER_DAMAGE 的 LifeSteal、ON_BEFORE_DAMAGE 的 ExecuteDamage）
    // 这些效果会在对应的阶段通过 cachedEffects 被触发
    if (trigger !== EffectTrigger.ON_SKILL_HIT && trigger !== undefined) {
      return;
    }

    // 创建效果实例和上下文（带日志收集器）
    const effect = EffectFactory.create(effectConfig);
    const effectContext = this.createEffectContext(caster, effectTarget, skill);

    // 根据效果类型分发处理
    switch (effectConfig.type) {
      case EffectType.Damage:
        // 执行效果获取基础值
        effect.apply(effectContext);
        // 收集日志
        if (effectContext.logCollector) {
          result.logs.push(...effectContext.logCollector.getLogMessages());
        }
        this.handleDamageEffect(ctx, effectContext);
        break;
      case EffectType.Heal:
        // 执行效果获取基础值
        effect.apply(effectContext);
        // 收集日志
        if (effectContext.logCollector) {
          result.logs.push(...effectContext.logCollector.getLogMessages());
        }
        this.handleHealEffect(ctx, effectContext);
        break;
      case EffectType.TrueDamage:
        // 真实伤害直接执行，不经过伤害管道
        effect.apply(effectContext);
        // 收集日志
        if (effectContext.logCollector) {
          result.logs.push(...effectContext.logCollector.getLogMessages());
        }
        break;
      // 其他类型效果（如 LifeSteal）通过 ON_AFTER_DAMAGE 钩子处理
      default:
        // 其他主动效果（如 AddBuff、ManaDrain、Dispel 等）
        effect.apply(effectContext);
        if (effectContext.logCollector) {
          result.logs.push(...effectContext.logCollector.getLogMessages());
        }
        break;
    }
  }

  /**
   * 确保有技能使用日志
   */
  private ensureSkillUsageLog(ctx: SkillExecutionContext): void {
    const { caster, skill, result } = ctx;
    const effects = skill.effects ?? [];

    // 只有伤害和治疗效果会自动生成日志
    // 纯 Buff 技能需要在开头添加使用日志
    const hasAutoLog = effects.some(
      (e) => e.type === EffectType.Damage || e.type === EffectType.Heal,
    );

    if (result.logs.length === 0) {
      // 没有任何日志，添加基础使用信息
      result.logs.push(`${caster.getName()} 使用「${skill.name}」`);
    } else if (!hasAutoLog) {
      // 有日志但没有伤害/治疗（纯 Buff 技能），在开头添加使用信息
      result.logs.unshift(`${caster.getName()} 使用「${skill.name}」`);
    }
  }

  /**
   * 消耗 MP 和设置冷却
   */
  private consumeResources(ctx: SkillExecutionContext): void {
    const { caster, skill, result } = ctx;

    const mpCost = skill.cost ?? 0;
    if (mpCost > 0) {
      caster.consumeMp(mpCost);
      result.mpCost = mpCost;
    }

    caster.setCooldown(skill.id!, skill.cooldown);
  }

  // ============================================================
  // 效果类型处理器
  // ============================================================

  /**
   * 处理伤害效果
   * 伤害管道：ON_BEFORE_DAMAGE -> 扣血 -> ON_BEING_HIT -> ON_AFTER_DAMAGE
   */
  private handleDamageEffect(
    ctx: SkillExecutionContext,
    effectContext: EffectContext,
  ): void {
    const { caster, effectTarget, skill, result, cachedBeforeDamageEffects } =
      ctx;
    const baseDamage = effectContext.value ?? 0;

    // 1. ON_BEFORE_DAMAGE: 暴击、减伤、护盾、斩杀等
    const beforeDamageResult = effectEngine.processWithContext(
      EffectTrigger.ON_BEFORE_DAMAGE,
      caster,
      effectTarget,
      baseDamage,
      effectContext.metadata,
      cachedBeforeDamageEffects,
    );

    // 合并 ON_BEFORE_DAMAGE 阶段的日志
    result.logs.push(...beforeDamageResult.logs);

    const finalDamage = Math.max(
      0,
      Math.floor(beforeDamageResult.ctx.value ?? 0),
    );
    const isCritical = beforeDamageResult.ctx.metadata?.isCritical === true;
    const shieldAbsorbed = beforeDamageResult.ctx.metadata?.shieldAbsorbed as
      | number
      | undefined;

    // 2. 应用伤害
    if (finalDamage > 0) {
      const actualDamage = effectTarget.applyDamage(finalDamage);
      result.damage += actualDamage;
      result.isCritical = result.isCritical || isCritical;

      // 生成日志
      result.logs.push(
        this.formatDamageLog(
          caster,
          effectTarget,
          skill.name,
          actualDamage,
          isCritical,
          shieldAbsorbed,
        ),
      );

      // 3. ON_BEING_HIT: 被击中时的反击等效果（从目标的角度）
      const beingHitResult = effectEngine.processWithContext(
        EffectTrigger.ON_BEING_HIT,
        effectTarget,
        caster,
        actualDamage,
        effectContext.metadata,
      );
      result.logs.push(...beingHitResult.logs);

      // 4. ON_AFTER_DAMAGE: 吸血、反伤等（Effect 直接处理，合并日志）
      this.processAfterDamage(ctx, effectContext, actualDamage);
    } else {
      result.logs.push(
        this.formatNoDamageLog(
          caster,
          effectTarget,
          skill.name,
          shieldAbsorbed,
        ),
      );
    }
  }

  /**
   * 处理 ON_AFTER_DAMAGE 阶段
   * 【重构后】Effect 直接处理吸血、反伤等，只需合并日志
   */
  private processAfterDamage(
    ctx: SkillExecutionContext,
    effectContext: EffectContext,
    actualDamage: number,
  ): void {
    const { caster, effectTarget, result, cachedAfterDamageEffects } = ctx;

    // 调用 ON_AFTER_DAMAGE 处理吸血、反伤等
    const afterDamageResult = effectEngine.processWithContext(
      EffectTrigger.ON_AFTER_DAMAGE,
      caster,
      effectTarget,
      actualDamage,
      effectContext.metadata,
      cachedAfterDamageEffects,
    );

    // 【重构】Effect 直接处理了状态修改，只需合并日志
    result.logs.push(...afterDamageResult.logs);
  }

  /**
   * 处理治疗效果
   */
  private handleHealEffect(
    ctx: SkillExecutionContext,
    effectContext: EffectContext,
  ): void {
    const { caster, effectTarget, skill, result } = ctx;
    const healValue = effectContext.value ?? 0;

    // 【修复】治疗目标应该是 effectTarget（考虑 target_self）
    const healTarget = effectTarget;
    const actualHeal = healTarget.applyHealing(healValue);
    result.healing += actualHeal;

    if (actualHeal > 0) {
      result.logs.push(
        `${caster.getName()} 使用「${skill.name}」，${healTarget === caster ? '' : `为 ${healTarget.getName()} `}恢复 ${actualHeal} 点气血`,
      );
    } else {
      result.logs.push(
        `${caster.getName()} 使用「${skill.name}」，${healTarget === caster ? '' : `${healTarget.getName()} `}气血充足，未能恢复气血`,
      );
    }
  }

  // ============================================================
  // 辅助方法
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

  /**
   * 创建效果上下文
   */
  private createEffectContext(
    caster: BattleUnit,
    effectTarget: BattleUnit,
    skill: Skill,
  ): EffectContext {
    return {
      source: caster,
      target: effectTarget,
      trigger: EffectTrigger.ON_SKILL_HIT,
      value: 0,
      metadata: {
        skillName: skill.name,
        skillElement: skill.element,
      },
      logCollector: new EffectLogCollector(),
    };
  }

  /**
   * 收集技能中指定触发时机的效果
   */
  private collectSkillEffects(
    skill: Skill,
    trigger: EffectTrigger,
    caster: BattleUnit,
  ): BaseEffect[] {
    return (skill.effects ?? [])
      .filter((e) => e.trigger === trigger)
      .map((e) => EffectFactory.create(e).setOwner(caster.id));
  }

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
   * 格式化伤害日志
   */
  private formatDamageLog(
    caster: BattleUnit,
    target: BattleUnit,
    skillName: string,
    damage: number,
    isCritical: boolean,
    shieldAbsorbed?: number,
  ): string {
    const critText = isCritical ? '暴击！' : '';
    const shieldText = shieldAbsorbed
      ? `（护盾吸收 ${shieldAbsorbed} 点伤害）`
      : '';
    return `${caster.getName()} 对 ${target.getName()} 使用「${skillName}」，${critText}造成 ${damage} 点伤害${shieldText}`;
  }

  /**
   * 格式化无伤害日志
   */
  private formatNoDamageLog(
    caster: BattleUnit,
    target: BattleUnit,
    skillName: string,
    shieldAbsorbed?: number,
  ): string {
    const shieldText = shieldAbsorbed
      ? `（护盾吸收 ${shieldAbsorbed} 点伤害）`
      : '';
    return `${caster.getName()} 对 ${target.getName()} 使用「${skillName}」，但未能造成伤害${shieldText}`;
  }
}

export const skillExecutor = new SkillExecutor();
