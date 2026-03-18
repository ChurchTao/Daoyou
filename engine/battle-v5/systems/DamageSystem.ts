import { Unit } from '../units/Unit';
import { AttributeType } from '../core/types';
import { EventBus } from '../core/EventBus';
import {
  SkillCastEvent,
  HitCheckEvent,
  DamageCalculateEvent,
  DamageEvent,
  DamageTakenEvent,
  UnitDeadEvent,
  EventPriorityLevel,
} from '../core/events';

export interface DamageCalculationParams {
  baseDamage: number;
  damageType: 'physical' | 'magic';
  element?: string;
  ignoreCrit?: boolean;
  ignoreDodge?: boolean;
}

export interface DamageResult {
  finalDamage: number;
  isCritical: boolean;
  isDodged: boolean;
  breakdown: {
    baseDamage: number;
    critMultiplier: number;
    damageReduction: number;
    randomFactor: number;
  };
}

/**
 * 伤害系统
 * 基于事件驱动的完整伤害管道
 */
export class DamageSystem {
  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 订阅技能释放事件，开始命中判定
    EventBus.instance.subscribe<SkillCastEvent>(
      'SkillCastEvent',
      (event) => this._onSkillCast(event),
      EventPriorityLevel.HIT_CHECK,
    );
  }

  /**
   * 响应技能释放事件，执行命中判定
   */
  private _onSkillCast(event: SkillCastEvent): void {
    const { caster, target, ability } = event;

    const hitCheckEvent: HitCheckEvent = {
      type: 'HitCheckEvent',
      priority: EventPriorityLevel.HIT_CHECK,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      isHit: true,
      isDodged: false,
      isResisted: false,
    };

    // 1. 身法闪避判定
    const casterAgility = caster.attributes.getValue(AttributeType.AGILITY);
    const targetAgility = target.attributes.getValue(AttributeType.AGILITY);
    const dodgeChance = Math.max(
      5,
      Math.min(80, ((targetAgility - casterAgility) / casterAgility) * 100),
    );

    if (Math.random() * 100 < dodgeChance) {
      hitCheckEvent.isDodged = true;
      hitCheckEvent.isHit = false;
    }

    // 2. 神识抵抗判定（仅控制/减益类技能）
    if (ability.isDebuffAbility && hitCheckEvent.isHit) {
      const casterConsciousness = caster.attributes.getValue(AttributeType.CONSCIOUSNESS);
      const targetConsciousness = target.attributes.getValue(AttributeType.CONSCIOUSNESS);
      const resistChance = Math.max(
        0,
        ((targetConsciousness - casterConsciousness) / casterConsciousness) * 100,
      );

      if (Math.random() * 100 < resistChance) {
        hitCheckEvent.isResisted = true;
        hitCheckEvent.isHit = false;
      }
    }

    // 发布命中判定事件
    EventBus.instance.publish(hitCheckEvent);

    // 未命中，直接终止流程
    if (!hitCheckEvent.isHit) return;

    // 命中成功，进入伤害计算
    this._calculateDamage(event, hitCheckEvent);
  }

  /**
   * 计算伤害
   */
  private _calculateDamage(castEvent: SkillCastEvent, hitEvent: HitCheckEvent): void {
    const { caster, target, ability } = castEvent;

    // 1. 计算基础伤害
    let baseDamage = ability.baseDamage;

    if (ability.isMagicAbility) {
      // 法术伤害：灵力 * 技能系数 + 固定值
      const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
      baseDamage = spirit * ability.damageCoefficient + ability.baseDamage;
    } else if (ability.isPhysicalAbility) {
      // 体术伤害：体魄 * 技能系数 + 固定值
      const physique = caster.attributes.getValue(AttributeType.PHYSIQUE);
      baseDamage = physique * ability.damageCoefficient + ability.baseDamage;
    }

    // 2. 发布伤害计算事件，供被动/命格/BUFF修正伤害
    const calcEvent: DamageCalculateEvent = {
      type: 'DamageCalculateEvent',
      priority: EventPriorityLevel.DAMAGE_CALC,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      baseDamage,
      finalDamage: baseDamage,
    };

    EventBus.instance.publish(calcEvent);

    // 3. 修正最终伤害：计算目标减伤，最低为1点伤害
    const targetPhysique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const damageReduction = Math.min(0.7, targetPhysique / (targetPhysique + 1000));
    calcEvent.finalDamage = Math.max(1, calcEvent.finalDamage * (1 - damageReduction));

    // 4. 进入伤害应用环节
    this._applyDamage(calcEvent);
  }

  /**
   * 应用伤害
   */
  private _applyDamage(calcEvent: DamageCalculateEvent): void {
    const { caster, target, ability, finalDamage } = calcEvent;

    // 1. 发布伤害事件，供护盾/无敌/伤害免疫类效果响应
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      finalDamage,
    };

    EventBus.instance.publish(damageEvent);

    // 2. 校验伤害是否被免疫/抵消
    if (damageEvent.finalDamage <= 0) return;

    // 3. 进入最终属性更新环节
    this._updateTargetHealth(damageEvent);
  }

  /**
   * 更新目标气血
   */
  private _updateTargetHealth(damageEvent: DamageEvent): void {
    const { target, finalDamage, caster } = damageEvent;

    // 获取当前气血
    const beforeHealth = target.currentHp;

    // 应用伤害
    target.takeDamage(finalDamage);

    const actualDamage = beforeHealth - target.currentHp;
    const isLethal = target.currentHp <= 0;

    // 发布受击事件
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: actualDamage,
      remainHealth: target.currentHp,
      isLethal,
    });

    // 击杀判定
    if (isLethal) {
      EventBus.instance.publish<UnitDeadEvent>({
        type: 'UnitDeadEvent',
        priority: EventPriorityLevel.DAMAGE_TAKEN,
        timestamp: Date.now(),
        unit: target,
        killer: caster,
      });
    }
  }

  /**
   * 销毁系统，取消订阅
   */
  destroy(): void {
    // TODO: 实现取消订阅逻辑
  }

  // ===== 保留静态方法用于测试兼容性 =====
  /**
   * 计算伤害
   * 流程: 基础伤害 → 暴击 → 闪避 → 减伤 → 随机浮动 → 最终伤害
   */
  static calculateDamage(
    attacker: Unit,
    target: Unit,
    params: DamageCalculationParams,
  ): DamageResult {
    const breakdown = {
      baseDamage: params.baseDamage,
      critMultiplier: 1,
      damageReduction: 0,
      randomFactor: 1,
    };

    let damage = params.baseDamage;

    // 1. 暴击判定
    const isCritical = !params.ignoreCrit && DamageSystem['rollCrit'](attacker);
    if (isCritical) {
      breakdown.critMultiplier = 1.5;
      damage *= breakdown.critMultiplier;
    }

    // 2. 闪避判定
    const isDodged = !params.ignoreDodge && DamageSystem['rollDodge'](target);
    if (isDodged) {
      return {
        finalDamage: 0,
        isCritical,
        isDodged: true,
        breakdown,
      };
    }

    // 3. 伤害减免（基础版，基于体魄）
    const reduction = DamageSystem['calculateDamageReduction'](target);
    breakdown.damageReduction = reduction;
    damage *= (1 - reduction);

    // 4. 随机浮动 (0.9 ~ 1.1)
    const randomFactor = 0.9 + Math.random() * 0.2;
    breakdown.randomFactor = randomFactor;
    damage *= randomFactor;

    // 5. 最小伤害保证
    const finalDamage = Math.max(1, Math.floor(damage));

    return {
      finalDamage,
      isCritical,
      isDodged: false,
      breakdown,
    };
  }

  /**
   * 暴击判定
   */
  private static rollCrit(attacker: Unit): boolean {
    const critRate = attacker.attributes.getCritRate();
    return Math.random() < critRate;
  }

  /**
   * 闪避判定
   */
  private static rollDodge(target: Unit): boolean {
    const evasionRate = target.attributes.getEvasionRate();
    return Math.random() < evasionRate;
  }

  /**
   * 计算伤害减免
   */
  private static calculateDamageReduction(target: Unit): number {
    // 基础减免：每点体魄提供 0.1% 减免，上限 75%
    const physique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const reduction = Math.min(0.75, physique * 0.001);
    return reduction;
  }
}
