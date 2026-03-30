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
import { AttributeType, DamageSource, DamageType } from '../core/types';

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
 * │  DOT伤害:  ActionPreEvent ─────────────────→ DamageRequestEvent     │
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

    // 关键修正：如果目标是自己，则跳过命中/闪避判定，直接命中
    if (caster.id === target.id) {
      hitCheckEvent.isHit = true;
    } else {
      // ===== ① 身法闪避判定（非线性公式）=====
      // 目标 EVASION_RATE（派生自 SPEED）减去施法者 ACCURACY，转为百分比
      const evasionRate = target.attributes.getValue(
        AttributeType.EVASION_RATE,
      );
      const accuracy = caster.attributes.getValue(AttributeType.ACCURACY);
      const dodgeChance = Math.max(
        0,
        Math.min(80, (evasionRate - accuracy) * 100),
      );
      if (Math.random() * 100 < dodgeChance) {
        hitCheckEvent.isDodged = true;
        hitCheckEvent.isHit = false;
      }

      // ===== ② 神识抵抗判定（仅控制/减益类技能）=====
      if (
        ability.tags.hasTag(GameplayTags.ABILITY.TYPE_CONTROL) &&
        hitCheckEvent.isHit
      ) {
        // 目标 CONTROL_RESISTANCE 减去施法者 CONTROL_HIT，转为百分比
        const controlResistance = target.attributes.getValue(
          AttributeType.CONTROL_RESISTANCE,
        );
        const controlHit = caster.attributes.getValue(
          AttributeType.CONTROL_HIT,
        );
        const resistChance = Math.max(
          0,
          (controlResistance - controlHit) * 100,
        );

        if (Math.random() * 100 < resistChance) {
          hitCheckEvent.isResisted = true;
          hitCheckEvent.isHit = false;
        }
      }
    }

    // 发布命中判定事件
    EventBus.instance.publish(hitCheckEvent);

    // 关键演进：将结果写回 SkillCastEvent 契约对象
    // 这允许 ActionExecutionSystem 决定是否拦截后续效果链
    event.isHit = hitCheckEvent.isHit;
    event.isDodged = hitCheckEvent.isDodged;
    event.isResisted = hitCheckEvent.isResisted;

    // 命中判定逻辑结束。不再此处自动发布 DamageRequestEvent。
    // 具体的伤害效果由 Ability 的效果链 (GameplayEffect) 主动发布。
  }

  // ==================== 统一伤害计算管道 ====================

  /**
   * 响应伤害请求事件，执行减伤、随机浮动和伤害应用
   * 所有伤害来源（技能、DOT、反伤）都走此管道
   *
   * 统一结算管道顺序：
   * ① 按伤害类型计算有效防御（物理DEF/法术DEF/真伤）
   * ② 应用减法防御（并保留10%保底穿透）
   * ③ 暴击判定（减伤后乘算）
   * ④ 随机浮动 (0.9~1.1)
   * ⑤ 最小伤害保证 + 四舍五入
   */
  private _onDamageRequest(event: DamageRequestEvent): void {
    const { target } = event;

    const damageType = this._resolveDamageType(event);

    // ===== ① 按伤害类型计算有效防御 =====
    let effectiveDef = 0;
    if (event.damageSource === DamageSource.DIRECT) {
      if (damageType === 'physical') {
        const baseDef = target.attributes.getValue(AttributeType.DEF);
        const armorPen = Math.max(
          0,
          Math.min(
            0.5,
            event.caster?.attributes.getValue(
              AttributeType.ARMOR_PENETRATION,
            ) ?? 0,
          ),
        );
        effectiveDef = baseDef * (1 - armorPen);
      } else if (damageType === 'magical') {
        const baseDef = target.attributes.getValue(AttributeType.MAGIC_DEF);
        const magicPen = Math.max(
          0,
          Math.min(
            0.5,
            event.caster?.attributes.getValue(
              AttributeType.MAGIC_PENETRATION,
            ) ?? 0,
          ),
        );
        effectiveDef = baseDef * (1 - magicPen);
      }
    }

    // ===== ② 应用减法防御（10%保底伤害） =====
    const preMitigationDamage = event.finalDamage;
    const reducedDamage = preMitigationDamage - effectiveDef;
    event.finalDamage = Math.max(preMitigationDamage * 0.1, reducedDamage);

    // ===== ③ 暴击判定（减伤后） =====
    // 仅在非 DOT/反伤且有施法者时参与暴击；已由上层标记为暴击的不再重算
    if (!event.isCritical && event.caster && event.damageSource !== 'reflect') {
      const rawCritRate = event.caster.attributes.getValue(
        AttributeType.CRIT_RATE,
      );
      const critResist = target.attributes.getValue(AttributeType.CRIT_RESIST);
      const effectiveCritRate = Math.max(
        0,
        Math.min(0.95, rawCritRate - critResist),
      );
      if (Math.random() < effectiveCritRate) {
        event.isCritical = true;
        const baseCritMult = event.caster.attributes.getValue(
          AttributeType.CRIT_DAMAGE_MULT,
        );
        const critDmgReduction = target.attributes.getValue(
          AttributeType.CRIT_DAMAGE_REDUCTION,
        );
        event.critMultiplier = Math.max(1.0, baseCritMult - critDmgReduction);
        event.finalDamage *= event.critMultiplier;
      }
    }

    // ===== ④ 随机浮动 (0.9 ~ 1.1，降低纯数值比拼的确定性) =====
    const randomFactor = 0.9 + Math.random() * 0.2;
    event.finalDamage = event.finalDamage * randomFactor;

    // ===== ⑤ 最小伤害保证（避免0伤害）并四舍五入 =====
    event.finalDamage = Math.max(1, Math.round(event.finalDamage));

    // 发布伤害应用事件（供护盾/无敌效果订阅）
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster: event.caster,
      target: event.target,
      ability: event.ability,
      buff: event.buff,
      damageSource: event.damageSource,
      damageType,
      finalDamage: event.finalDamage,
      isCritical: event.isCritical,
      critMultiplier: event.critMultiplier,
    };

    EventBus.instance.publish(damageEvent);

    // 直接应用伤害（不再通过订阅 DamageEvent）
    this._updateTargetHealth(damageEvent);
  }

  private _resolveDamageType(event: DamageRequestEvent): DamageType {
    if (event.damageType) return event.damageType;

    const tags = event.ability?.tags || event.buff?.tags;
    if (tags?.hasTag(GameplayTags.ABILITY.TYPE_TRUE_DAMAGE)) {
      return DamageType.TRUE;
    }
    if (tags?.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)) {
      return DamageType.MAGICAL;
    }
    if (tags?.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)) {
      return DamageType.PHYSICAL;
    }
    if (tags?.hasTag(GameplayTags.BUFF.DOT)) {
      return DamageType.DOT;
    }

    return DamageType.PHYSICAL; // 默认物理伤害
  }

  // ==================== 伤害应用 ====================

  /**
   * 更新目标气血，发布受击事件
   */
  private _updateTargetHealth(damageEvent: DamageEvent): void {
    const {
      target,
      finalDamage,
      caster,
      ability,
      buff,
      isCritical,
      critMultiplier,
    } = damageEvent;

    // 获取当前状态
    const beforeHealth = target.currentHp;
    const beforeShield = target.currentShield;

    // 1. 优先使用护盾吸收伤害
    const remainingDamage = target.absorbDamage(finalDamage);
    const absorbedAmount = beforeShield - target.currentShield;

    // 2. 应用剩余伤害到气血
    target.takeDamage(remainingDamage);

    const actualDamage = beforeHealth - target.currentHp;

    // 发布受击事件（包含护盾抵扣和技能/暴击信息）
    // 注意：在这里发布事件，允许监听器（如免死效果）修改单位状态
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      buff, // 传递 buff
      damageSource: damageEvent.damageSource,
      damageType: damageEvent.damageType,
      reflectSourceName:
        damageEvent.damageSource === 'reflect' ? caster?.name : undefined,
      damageTaken: actualDamage,
      remainHealth: target.currentHp, // 此时可能为 0
      shieldAbsorbed: absorbedAmount,
      remainShield: target.currentShield,
      isLethal: target.currentHp <= 0,
      isCritical,
      critMultiplier,
    });

    // 最终判定：在所有 DamageTakenEvent 监听器执行完后，重新检查存活状态
    // 如果免死效果生效，target.currentHp 会变为 1，从而跳过此处的阵亡发布
    if (target.currentHp <= 0) {
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
