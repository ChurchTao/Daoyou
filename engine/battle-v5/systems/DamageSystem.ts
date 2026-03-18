import { EventBus } from '../core/EventBus';
import {
  DamageCalculateEvent,
  DamageEvent,
  DamageTakenEvent,
  EventPriorityLevel,
  HitCheckEvent,
  SkillCastEvent,
  UnitDeadEvent,
} from '../core/events';
import { AttributeType } from '../core/types';

/**
 * 伤害系统
 * 基于事件驱动的完整伤害管道
 */
export class DamageSystem {
  private _handlers: Map<string, (event: SkillCastEvent) => void> = new Map();

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 订阅技能释放事件，开始命中判定
    const skillCastHandler = (event: SkillCastEvent) =>
      this._onSkillCast(event);
    EventBus.instance.subscribe<SkillCastEvent>(
      'SkillCastEvent',
      skillCastHandler,
      EventPriorityLevel.HIT_CHECK,
    );
    this._handlers.set('SkillCastEvent', skillCastHandler);
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
      const casterConsciousness = caster.attributes.getValue(
        AttributeType.CONSCIOUSNESS,
      );
      const targetConsciousness = target.attributes.getValue(
        AttributeType.CONSCIOUSNESS,
      );
      const resistChance = Math.max(
        0,
        ((targetConsciousness - casterConsciousness) / casterConsciousness) *
          100,
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
   * 流程: 基础伤害 → 暴击判定 → 伤害修正事件 → 减伤 → 随机浮动 → 最终伤害
   */
  private _calculateDamage(
    castEvent: SkillCastEvent,
    hitEvent: HitCheckEvent,
  ): void {
    const { caster, target, ability } = castEvent;

    // 1. 计算基础伤害（根据技能类型和对应属性）
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

    // 2. 暴击判定（身法属性核心价值：暴击率）
    const casterAgility = caster.attributes.getValue(AttributeType.AGILITY);
    const targetConsciousness = target.attributes.getValue(
      AttributeType.CONSCIOUSNESS,
    );

    // 暴击率公式：身法/100 + 基础5%，最高60%，被神识抗性降低
    let critRate = Math.min(60, casterAgility / 100 + 5);
    // 目标神识高于施法者时，降低暴击率
    if (targetConsciousness > casterAgility) {
      critRate *= 0.7;
    }
    const isCritical = Math.random() * 100 < critRate;
    const critMultiplier = isCritical ? 1.5 + casterAgility / 1000 : 1; // 暴击倍率：基础1.5倍 + 身法加成

    // 3. 发布伤害计算事件，供被动/命格/BUFF修正伤害（增伤/减伤效果在此订阅）
    const currentDamage = baseDamage * critMultiplier;

    const calcEvent: DamageCalculateEvent = {
      type: 'DamageCalculateEvent',
      priority: EventPriorityLevel.DAMAGE_CALC,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      baseDamage,
      finalDamage: currentDamage,
      isCritical,
      critMultiplier,
    };

    EventBus.instance.publish(calcEvent);

    // 4. 修正最终伤害：计算目标减伤（体魄属性核心价值：减伤）
    const targetPhysique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const damageReduction = Math.min(
      0.7,
      targetPhysique / (targetPhysique + 1000),
    );

    calcEvent.finalDamage = calcEvent.finalDamage * (1 - damageReduction);

    // 5. 随机浮动 (0.9 ~ 1.1，降低纯数值比拼的确定性)
    const randomFactor = 0.9 + Math.random() * 0.2;
    calcEvent.finalDamage = calcEvent.finalDamage * randomFactor;

    // 6. 最小伤害保证（避免0伤害）并四舍五入
    calcEvent.finalDamage = Math.max(1, Math.round(calcEvent.finalDamage));

    // 7. 进入伤害应用环节
    this._applyDamage(calcEvent);
  }

  /**
   * 应用伤害
   */
  private _applyDamage(calcEvent: DamageCalculateEvent): void {
    const { caster, target, ability, finalDamage, isCritical, critMultiplier } = calcEvent;

    // 1. 发布伤害事件，供护盾/无敌/伤害免疫类效果响应
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      finalDamage,
      isCritical,
      critMultiplier,
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
    const { target, finalDamage, caster, ability, isCritical, critMultiplier } = damageEvent;

    // 获取当前气血
    const beforeHealth = target.currentHp;

    // 应用伤害
    target.takeDamage(finalDamage);

    const actualDamage = beforeHealth - target.currentHp;
    const isLethal = target.currentHp <= 0;

    // 发布受击事件（包含技能和暴击信息）
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      damageTaken: actualDamage,
      remainHealth: target.currentHp,
      isLethal,
      isCritical,
      critMultiplier,
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
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
