import { ActiveSkill } from '../abilities/ActiveSkill';
import { EventBus } from '../core/EventBus';
import { GameplayTags } from '../core/GameplayTags';
import {
  DamageEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  EventPriorityLevel,
  HitCheckEvent,
  SkillCastEvent,
  UnitDeadEvent,
} from '../core/events';
import { AttributeType } from '../core/types';

/**
 * DamageSystem - 伤害系统
 *
 * EDA 架构设计：
 * - 订阅 SkillCastEvent，执行命中判定，发布 DamageRequestEvent
 * - 订阅 DamageRequestEvent，执行减伤计算，发布 DamageEvent 并直接应用伤害
 * - 不订阅 DamageEvent（避免循环），由 _onDamageRequest 直接调用 _updateTargetHealth
 *
 * 统一伤害管道：
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  技能伤害: SkillCastEvent → HitCheckEvent → DamageRequestEvent     │
 * │  DOT伤害:  RoundPreEvent ─────────────────→ DamageRequestEvent     │
 * │  反伤等:   其他来源 ──────────────────────→ DamageRequestEvent     │
 * └─────────────────────────────────────────────────────────────────────┘
 *                              ↓
 *         DamageRequestEvent → [增伤修正] → [减伤/随机] → DamageEvent
 *                              ↓
 *         DamageEvent → [护盾/免疫响应] → 气血更新 → DamageTakenEvent
 *                    （其他系统订阅）      （本系统直接调用）
 */
export class DamageSystem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 1. 订阅技能释放事件，执行命中判定
    const skillCastHandler = (event: SkillCastEvent) =>
      this._onSkillCast(event);
    EventBus.instance.subscribe<SkillCastEvent>(
      'SkillCastEvent',
      skillCastHandler,
      EventPriorityLevel.HIT_CHECK,
    );
    this._handlers.set('SkillCastEvent', skillCastHandler);

    // 2. 订阅伤害请求事件，执行减伤、随机浮动和伤害应用
    // 注意：不再订阅 DamageEvent，避免循环
    const damageRequestHandler = (event: DamageRequestEvent) =>
      this._onDamageRequest(event);
    EventBus.instance.subscribe<DamageRequestEvent>(
      'DamageRequestEvent',
      damageRequestHandler,
      EventPriorityLevel.DAMAGE_REQUEST,
    );
    this._handlers.set('DamageRequestEvent', damageRequestHandler);
  }

  // ==================== 技能伤害流程 ====================

  /**
   * 响应技能释放事件，执行命中判定
   * 流程：SkillCastEvent → HitCheckEvent → DamageRequestEvent
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
    if (
      ability.tags.hasTag(GameplayTags.ABILITY.TYPE_CONTROL) &&
      hitCheckEvent.isHit
    ) {
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

    // 命中成功，计算基础伤害并发布 DamageRequestEvent
    this._publishDamageRequestEvent(event, hitCheckEvent);
  }

  /**
   * 计算技能基础伤害，发布 DamageRequestEvent
   * 注意：此处只计算基础伤害和暴击，不计算减伤
   * 减伤和随机浮动由 _onDamageRequest 统一处理
   */
  private _publishDamageRequestEvent(
    castEvent: SkillCastEvent,
    _hitEvent: HitCheckEvent,
  ): void {
    const { caster, target, ability } = castEvent;

    // 只处理 ActiveSkill 类型的能力（有伤害属性）
    const skill = ability instanceof ActiveSkill ? ability : null;

    // 1. 计算基础伤害（根据技能类型和对应属性）
    let baseDamage = skill?.baseDamage ?? 0;

    if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)) {
      // 法术伤害：灵力 * 技能系数 + 固定值
      const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
      baseDamage =
        spirit * (skill?.damageCoefficient ?? 1.0) + (skill?.baseDamage ?? 0);
    } else if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)) {
      // 体术伤害：体魄 * 技能系数 + 固定值
      const physique = caster.attributes.getValue(AttributeType.PHYSIQUE);
      baseDamage =
        physique * (skill?.damageCoefficient ?? 1.0) + (skill?.baseDamage ?? 0);
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
    const critMultiplier = isCritical ? 1.5 + casterAgility / 1000 : 1;

    // 3. 计算当前伤害（基础 × 暴击倍率）
    const currentDamage = baseDamage * critMultiplier;

    // 4. 发布伤害请求事件
    // 其他系统（被动、命格、Buff）可订阅此事件修正伤害（增伤效果）
    const requestEvent: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      priority: EventPriorityLevel.DAMAGE_REQUEST,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      baseDamage,
      finalDamage: currentDamage,
      isCritical,
      critMultiplier,
    };

    EventBus.instance.publish(requestEvent);
  }

  // ==================== 统一伤害计算管道 ====================

  /**
   * 响应伤害请求事件，执行减伤、随机浮动和伤害应用
   * 所有伤害来源（技能、DOT、反伤）都走此管道
   *
   * 流程：DamageRequestEvent → [减伤/随机浮动] → DamageEvent → _updateTargetHealth
   */
  private _onDamageRequest(event: DamageRequestEvent): void {
    const { target, finalDamage } = event;

    // 1. 计算目标减伤（体魄属性核心价值：减伤）
    const targetPhysique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const damageReduction = Math.min(
      0.7,
      targetPhysique / (targetPhysique + 1000),
    );

    event.finalDamage = finalDamage * (1 - damageReduction);

    // 2. 随机浮动 (0.9 ~ 1.1，降低纯数值比拼的确定性)
    const randomFactor = 0.9 + Math.random() * 0.2;
    event.finalDamage = event.finalDamage * randomFactor;

    // 3. 最小伤害保证（避免0伤害）并四舍五入
    event.finalDamage = Math.max(1, Math.round(event.finalDamage));

    // 4. 发布伤害应用事件（供护盾/无敌效果订阅）
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster: event.caster,
      target: event.target,
      ability: event.ability,
      finalDamage: event.finalDamage,
      isCritical: event.isCritical,
      critMultiplier: event.critMultiplier,
    };

    EventBus.instance.publish(damageEvent);

    // 5. 直接应用伤害（不再通过订阅 DamageEvent）
    // 这避免了 DamageSystem 既发布又订阅同一事件的循环
    this._updateTargetHealth(damageEvent);
  }

  // ==================== 伤害应用 ====================

  /**
   * 更新目标气血，发布受击事件
   */
  private _updateTargetHealth(damageEvent: DamageEvent): void {
    const { target, finalDamage, caster, ability, isCritical, critMultiplier } =
      damageEvent;

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
