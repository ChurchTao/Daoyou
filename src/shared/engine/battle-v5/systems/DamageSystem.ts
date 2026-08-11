import { getRealmDamagePressureMultiplier } from '@shared/config/realmProgression';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { battleRandom, type BattleRandomSource } from '../core/BattleRandom';
import { EventBus } from '../core/EventBus';
import {
  DamageEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  DodgeEvent,
  EventPriorityLevel,
  HitCheckEvent,
  ShieldBreakEvent,
  SkillCastEvent,
} from '../core/events';
import { markDamageDealt } from '../core/runtimeState';
import {
  AttributeType,
  type DamageComponent,
  DamageSource,
  DamageType,
} from '../core/types';
import { CombatResultEmitterV3 } from '../v3/CombatResultEmitterV3';
import { CombatAttributionV3 } from '../v3/origin';
import { calculateSpiritualRootDamageMultiplier } from './spiritualRootResonance';

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
 *         DamageRequestEvent → [增伤修正] → [灵根共鸣/减伤/随机] → DamageEvent
 *                              ↓
 *         DamageEvent → [护盾/免疫响应] → 气血更新 → DamageTakenEvent
 *                    （其他系统订阅）      （本系统直接调用）
 */
export class DamageSystem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();

  constructor(
    private readonly eventBus: EventBus = EventBus.instance,
    private readonly random: BattleRandomSource = { next: battleRandom },
  ) {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 1. 订阅技能释放事件，执行命中判定
    const skillCastHandler = (event: SkillCastEvent) =>
      this._onSkillCast(event);
    this.eventBus.subscribe<SkillCastEvent>(
      'SkillCastEvent',
      skillCastHandler,
      EventPriorityLevel.HIT_CHECK,
    );
    this._handlers.set('SkillCastEvent', skillCastHandler);

    // 2. 订阅伤害请求事件，执行减伤、随机浮动和伤害应用
    // 注意：不再订阅 DamageEvent，避免循环
    const damageRequestHandler = (event: DamageRequestEvent) =>
      this._onDamageRequest(event);
    this.eventBus.subscribe<DamageRequestEvent>(
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
      timestamp: caster.runtime.clock.now(),
      caster,
      target,
      ability,
      isHit: true,
      isDodged: false,
      isResisted: false,
      hitPolicy: event.hitPolicy,
    };

    // 自身技能与必然命中技能跳过命中/闪避随机判定。
    if (caster === target || event.hitPolicy === 'guaranteed') {
      hitCheckEvent.isHit = true;
    } else {
      // ===== ① 身法闪避判定 =====
      // 目标 EVASION_RATE 减去施法者 ACCURACY，转为百分比并保留闪避手感上下限
      const evasionRate = target.attributes.getValue(
        AttributeType.EVASION_RATE,
      );
      const accuracy = caster.attributes.getValue(AttributeType.ACCURACY);
      const dodgeChance = Math.max(
        3,
        Math.min(45, (evasionRate - accuracy) * 100),
      );
      if (this.random.next() * 100 < dodgeChance) {
        hitCheckEvent.isDodged = true;
        hitCheckEvent.isHit = false;
      }

      // 神识抵抗在 ApplyBuffEffect 内按控制效果逐个结算，不能阻断伤害链。
    }

    // 发布命中判定事件
    const publishedHitCheck = this.eventBus.publish(hitCheckEvent);

    if (hitCheckEvent.isDodged) {
      const attribution = CombatAttributionV3.owned(target, {
        kind: 'mechanic',
        id: 'evasion',
        name: '闪避',
      });
      if (!publishedHitCheck.trace)
        throw new Error('Dodge result has no trace');
      new CombatResultEmitterV3().commit(
        target,
        { type: 'defense', defense: 'dodge' },
        { origin: attribution.origin, parentTrace: publishedHitCheck.trace },
      );
      this.eventBus.publish<DodgeEvent>({
        type: 'DodgeEvent',
        timestamp: caster.runtime.clock.now(),
        caster,
        target,
        ability,
      });
    }

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
   * ② 应用平滑防御 A²/(A+D)
   * ③ 应用现有增伤/减伤乘区
   * ④ 应用灵根共鸣/失配倍率
   * ⑤ 暴击判定（减伤后）
   * ⑥ 随机浮动 (0.9~1.1)
   * ⑦ 最小伤害保证 + 四舍五入
   */
  private _onDamageRequest(event: DamageRequestEvent): void {
    if (!event.target.isAlive()) {
      return;
    }

    const { target } = event;

    const damageType = this._resolveDamageType(event);

    if (event.calculationMode === 'resolved_final') {
      event.finalDamage = Math.max(1, Math.round(event.finalDamage));
      this._applyResolvedDamage(event, damageType);
      return;
    }

    // ===== ① 按伤害类型计算有效防御 =====
    let effectiveDef = 0;
    if (
      event.damageSource === DamageSource.DIRECT ||
      event.damageSource === DamageSource.COUNTER ||
      event.damageSource === DamageSource.FOLLOW_UP
    ) {
      if (damageType === DamageType.PHYSICAL) {
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
      } else if (damageType === DamageType.MAGICAL) {
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

    // ===== ② 应用平滑防御 A²/(A+D) =====
    const preMitigationDamage = event.finalDamage;
    event.finalDamage = this._applyDefense(
      event,
      preMitigationDamage,
      effectiveDef,
    );

    // ===== ③ 同乘区加算（增伤/减伤）=====
    // NOTE: 将百分比增减伤放在防御结算后、暴击判定前，保持乘区职责清晰。
    const increasePct = Math.max(0, event.damageIncreasePctBucket ?? 0);
    const reductionPct = Math.min(
      0.7,
      Math.max(0, event.damageReductionPctBucket ?? 0),
    );
    const damageMultiplier = Math.max(0, 1 + increasePct - reductionPct);
    event.finalDamage *= damageMultiplier;

    // ===== ④ 境界威压倍率 =====
    event.finalDamage *= this._getRealmDamageMultiplier(event);

    // ===== ⑤ 灵根共鸣/失配倍率 =====
    event.finalDamage *= calculateSpiritualRootDamageMultiplier(event);

    // ===== ⑥ 暴击判定（减伤后） =====
    // 反击/追击与直接伤害一样可暴击；强制暴击仍应用施法者暴击倍率。
    if (
      event.caster &&
      event.canCrit !== false &&
      event.damageSource !== DamageSource.REFLECT
    ) {
      const rawCritRate = event.caster.attributes.getValue(
        AttributeType.CRIT_RATE,
      );
      const critResist = target.attributes.getValue(AttributeType.CRIT_RESIST);
      const effectiveCritRate = Math.max(
        0,
        Math.min(0.95, rawCritRate - critResist),
      );
      if (
        event.forceCritical ||
        event.isCritical ||
        this.random.next() < effectiveCritRate
      ) {
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

    // ===== ⑦ 随机浮动 (0.9 ~ 1.1，降低纯数值比拼的确定性) =====
    const randomFactor = 0.9 + this.random.next() * 0.2;
    event.finalDamage = event.finalDamage * randomFactor;

    // ===== ⑧ 最小伤害保证（避免0伤害）并四舍五入 =====
    event.finalDamage = Math.max(1, Math.round(event.finalDamage));

    this._applyResolvedDamage(event, damageType);
  }

  private _applyResolvedDamage(
    event: DamageRequestEvent,
    damageType: DamageType,
  ): void {
    // 发布伤害应用事件（供护盾/无敌效果订阅）
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      timestamp: event.target.runtime.clock.now(),
      caster: event.caster,
      target: event.target,
      ability: event.ability,
      buff: event.buff,
      damageSource: event.damageSource,
      damageType,
      calculationMode: event.calculationMode,
      cause: event.cause,
      damageTags: event.damageTags,
      finalDamage: event.finalDamage,
      isCritical: event.isCritical,
      critMultiplier: event.critMultiplier,
      canLifesteal: event.canLifesteal,
    };

    this.eventBus.publish(damageEvent);

    // 直接应用伤害（不再通过订阅 DamageEvent）
    this._updateTargetHealth(damageEvent, damageType);
  }

  private _resolveDamageType(event: DamageRequestEvent): DamageType {
    if (event.damageType) return event.damageType;

    const tags = event.ability?.tags || event.buff?.tags;
    if (tags?.hasTag(GameplayTags.ABILITY.CHANNEL.TRUE)) {
      return DamageType.TRUE;
    }
    if (tags?.hasTag(GameplayTags.ABILITY.CHANNEL.MAGIC)) {
      return DamageType.MAGICAL;
    }
    if (tags?.hasTag(GameplayTags.ABILITY.CHANNEL.PHYSICAL)) {
      return DamageType.PHYSICAL;
    }
    if (tags?.hasTag(GameplayTags.BUFF.DOT.ROOT)) {
      return DamageType.DOT;
    }

    return DamageType.PHYSICAL; // 默认物理伤害
  }

  private _applyDefense(
    event: DamageRequestEvent,
    preMitigationDamage: number,
    effectiveDef: number,
  ): number {
    const components = event.damageComponents?.filter(
      (component): component is DamageComponent =>
        Number.isFinite(component.amount) && component.amount > 0,
    );
    if (!components?.length) {
      return this._applySmoothDefense(preMitigationDamage, effectiveDef);
    }

    const componentTotal = components.reduce(
      (sum, component) => sum + component.amount,
      0,
    );
    if (componentTotal <= 0) {
      return this._applySmoothDefense(preMitigationDamage, effectiveDef);
    }

    const scale = preMitigationDamage / componentTotal;
    return components.reduce((sum, component) => {
      if (component.mitigation === 'bypass_defense') {
        return sum + component.amount * scale;
      }

      if (
        component.attackBase !== undefined &&
        component.segmentMultiplier !== undefined
      ) {
        const attackBase = Math.max(0, component.attackBase);
        const multiplier = Math.max(0, component.segmentMultiplier) * scale;
        const afterDefense = this._applySmoothDefense(attackBase, effectiveDef);
        return sum + afterDefense * multiplier;
      }

      // 旧伤害事件兼容：历史生产方仍可读取 defenseScale，但新代码不得写入。
      const legacyAmount = component.amount * scale;
      const legacyDefenseScale = Math.max(0, component.defenseScale ?? 1);
      return (
        sum +
        this._applySmoothDefense(
          legacyAmount,
          effectiveDef * legacyDefenseScale,
        )
      );
    }, 0);
  }

  private _applySmoothDefense(
    attackBase: number,
    effectiveDef: number,
  ): number {
    const attack = Math.max(0, attackBase);
    const defense = Math.max(0, effectiveDef);
    if (attack <= 0) return 0;
    return (attack * attack) / (attack + defense);
  }

  private _getRealmDamageMultiplier(event: DamageRequestEvent): number {
    const attackerRank = event.caster?.getRealmMeta().realmRank;
    const defenderRank = event.target.getRealmMeta().realmRank;
    if (attackerRank === undefined || defenderRank === undefined) {
      return 1;
    }
    return getRealmDamagePressureMultiplier(attackerRank - defenderRank);
  }

  // ==================== 伤害应用 ====================

  /**
   * 更新目标气血，发布受击事件
   */
  private _updateTargetHealth(
    damageEvent: DamageEvent,
    damageType: DamageType,
  ): void {
    const {
      target,
      finalDamage,
      caster,
      ability,
      buff,
      isCritical,
      critMultiplier,
      canLifesteal,
    } = damageEvent;

    if (finalDamage <= 0) {
      return;
    }

    const parentTrace = damageEvent.trace;
    const origin = damageEvent.origin;
    if (!parentTrace || !origin) {
      throw new Error(
        'Damage settlement requires explicit V3 trace and origin',
      );
    }
    const damageResultTrace = this.eventBus.reserveResolutionTrace(
      parentTrace.eventId,
    );
    const { resolutionId } = damageResultTrace;

    // 获取当前状态
    const beforeHp = target.getCurrentHp();
    const beforeShield = target.getCurrentShield();

    // 1. 优先使用护盾吸收伤害
    const remainingDamage = target.absorbDamage(finalDamage);
    const absorbedAmount = beforeShield - target.getCurrentShield();

    if (beforeShield > 0 && target.getCurrentShield() <= 0) {
      this.eventBus.publish<ShieldBreakEvent>({
        type: 'ShieldBreakEvent',
        timestamp: target.runtime.clock.now(),
        caster,
        target,
        ability,
        buff,
        brokenShieldAmount: beforeShield,
        overflowDamage: remainingDamage,
        damageSource: damageEvent.damageSource,
      });
    }

    // 2. 应用剩余伤害到气血
    target.takeDamage(remainingDamage);
    const actualHpDamage = Math.max(0, beforeHp - target.getCurrentHp());
    if (actualHpDamage + absorbedAmount > 0) {
      markDamageDealt(caster);
      if (damageEvent.damageSource === DamageSource.DIRECT) {
        caster?.combatResources.markDirectDamageDealt();
      }
    }

    // 发布受击事件（包含护盾抵扣和技能/暴击信息）
    // 注意：在这里发布事件，允许监听器（如免死效果）修改单位状态
    const damageTakenTrace = this.eventBus.reserveTrace({
      resolutionId,
      parentEventId: parentTrace.eventId,
    });
    this.eventBus.runInCausalContext({ origin, trace: parentTrace }, () =>
      this.eventBus.publish<DamageTakenEvent>({
        type: 'DamageTakenEvent',
        timestamp: target.runtime.clock.now(),
        caster,
        target,
        ability,
        buff, // 传递 buff
        damageSource: damageEvent.damageSource,
        damageType,
        calculationMode: damageEvent.calculationMode,
        cause: damageEvent.cause,
        damageTags: damageEvent.damageTags,
        reflectSourceName:
          damageEvent.damageSource === DamageSource.REFLECT
            ? caster?.name
            : undefined,
        damageTaken: actualHpDamage,
        beforeHp,
        remainHp: target.getCurrentHp(), // 此时可能为 0
        shieldAbsorbed: absorbedAmount,
        remainShield: target.getCurrentShield(),
        hpReachedZeroBeforeReactions: target.getCurrentHp() <= 0,
        isCritical,
        critMultiplier,
        canLifesteal,
        trace: damageTakenTrace,
        origin,
      }),
    );

    const finalHp = target.getCurrentHp();
    const damageResult = new CombatResultEmitterV3().commit(
      target,
      {
        type: 'damage',
        amount: Math.round(actualHpDamage),
        beforeHp: Math.round(beforeHp),
        afterHp: Math.round(finalHp),
        damageType,
        damageSource: damageEvent.damageSource,
        critical: isCritical ?? false,
        shieldAbsorbed: Math.round(absorbedAmount),
      },
      { origin, parentTrace, reservedTrace: damageResultTrace },
    );

    if (beforeHp > 0 && finalHp <= 0) {
      target.buffs.removeBuffsOnDeath();
      new CombatResultEmitterV3().commit(
        target,
        {
          type: 'unit_died',
          killer: caster ? { id: caster.id, name: caster.name } : undefined,
        },
        { origin, parentTrace: damageResult.trace! },
      );
    }
  }

  /**
   * 销毁系统，取消订阅
   */
  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      this.eventBus.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
