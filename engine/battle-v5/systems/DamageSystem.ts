import { ActiveSkill } from '../abilities/ActiveSkill';
import { EventBus } from '../core/EventBus';
import { GameplayTags } from '../core/GameplayTags';
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
 * DamageSystem - 伤害系统
 *
 * EDA 架构设计：
 * - 订阅 SkillCastEvent 事件，执行命中判定和伤害计算
 * - 发布 HitCheckEvent、DamageCalculateEvent、DamageEvent 等事件
 * - 其他系统（被动、命格、Buff）可订阅这些事件进行干预
 *
 * 伤害计算流程：
 * 1. 命中判定（闪避/抵抗）
 * 2. 基础伤害计算（灵力/体魄 × 技能系数）
 * 3. 暴击判定（身法属性）
 * 4. 伤害修正事件（增伤/减伤效果）
 * 5. 减伤计算（体魄属性）
 * 6. 随机浮动
 * 7. 伤害应用和受击事件
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

    // 订阅伤害应用事件（处理 DOT、反伤等外部直接伤害）
    const damageHandler = (event: DamageEvent) => this._onDamageEvent(event);
    EventBus.instance.subscribe<DamageEvent>(
      'DamageEvent',
      damageHandler,
      EventPriorityLevel.DAMAGE_APPLY,
    );
    this._handlers.set('DamageEvent', damageHandler);
  }

  /**
   * 响应直接伤害事件（DOT、反伤等）
   */
  private _onDamageEvent(event: DamageEvent): void {
    // 如果已经结算（比如由 _applyDamage 触发的），则不再重复结算
    // 这里我们可以根据 timestamp 或某种标记来防止循环，
    // 但更简单的逻辑是：_applyDamage 负责发布，而 _updateTargetHealth 负责更新。
    // 如果是外部发布的 DamageEvent，则需要通过 _updateTargetHealth 完成最后一步。
    
    // 我们检查这个 DamageEvent 是否已经应用过。
    // 在本系统中，_applyDamage 发布 DamageEvent 后直接调用 _updateTargetHealth。
    // 所以如果是外部发布的，我们需要捕获并调用 _updateTargetHealth。
    
    // 为了防止重入，我们检查当前事件是否来自于本系统的 _applyDamage 调用。
    // 这里简单地通过判断目标血量是否已经在当前回合变动可能不准确。
    // 更好的做法是：_applyDamage 内部调用 _updateTargetHealth 时，不走事件订阅。
    // 或者，让 _applyDamage 只发布事件，由 _onDamageEvent 统一处理。
    
    // 方案：统一由 _onDamageEvent 处理 DamageEvent。
    this._updateTargetHealth(event);
  }

  /**
   * 响应技能释放事件，执行命中判定
   * EDA 模式：通过订阅 SkillCastEvent 被动触发
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

    // 命中成功，进入伤害计算
    this._calculateDamage(event, hitCheckEvent);
  }

  /**
   * 计算伤害
   * 流程: 基础伤害 → 暴击判定 → 伤害修正事件 → 减伤 → 随机浮动 → 最终伤害
   */
  private _calculateDamage(
    castEvent: SkillCastEvent,
    _hitEvent: HitCheckEvent, // 预留参数，供未来扩展（如根据命中类型调整伤害）
  ): void {
    const { caster, target, ability } = castEvent;

    // 只处理 ActiveSkill 类型的能力（有伤害属性）
    const skill = ability instanceof ActiveSkill ? ability : null;

    // 1. 计算基础伤害（根据技能类型和对应属性）
    let baseDamage = skill?.baseDamage ?? 0;

    if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)) {
      // 法术伤害：灵力 * 技能系数 + 固定值
      const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
      baseDamage = spirit * (skill?.damageCoefficient ?? 1.0) + (skill?.baseDamage ?? 0);
    } else if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)) {
      // 体术伤害：体魄 * 技能系数 + 固定值
      const physique = caster.attributes.getValue(AttributeType.PHYSIQUE);
      baseDamage = physique * (skill?.damageCoefficient ?? 1.0) + (skill?.baseDamage ?? 0);
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
    const { caster, target, ability, finalDamage, isCritical, critMultiplier } =
      calcEvent;

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

    // 2. 注意：以前在这里直接调用 _updateTargetHealth。
    // 现在我们统一通过订阅 DamageEvent 的 _onDamageEvent 来调用 _updateTargetHealth。
    // 这确保了无论是技能产生的伤害，还是外部（DOT、反伤）发布的伤害，都走统一的处理和日志路径。
  }

  /**
   * 更新目标气血
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
