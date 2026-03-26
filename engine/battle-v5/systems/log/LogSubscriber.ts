import { EventBus } from '../../core/EventBus';
import {
  ActionPreEvent,
  ActionEvent,
  BuffAppliedEvent,
  BuffImmuneEvent,
  BuffRemovedEvent,
  CooldownModifyEvent,
  DamageTakenEvent,
  DeathPreventEvent,
  DispelEvent,
  EventPriorityLevel,
  HealEvent,
  HitCheckEvent,
  ManaBurnEvent,
  ReflectEvent,
  ResourceDrainEvent,
  ShieldEvent,
  SkillCastEvent,
  SkillInterruptEvent,
  TagTriggerEvent,
  UnitDeadEvent,
  RoundStartEvent,
  BattleInitEvent,
  BattleEndEvent,
} from '../../core/events';
import { LogAggregator } from './LogAggregator';
import { LogEntry } from './types';

/**
 * LogSubscriber 职责：监听 EventBus 事件，转换为 LogEntry，并路由到正确的 Span。
 */
export class LogSubscriber {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();
  private _nextEntryId: number = 0;

  constructor(private _aggregator: LogAggregator) {}

  /**
   * 显式订阅
   */
  subscribe(eventBus: EventBus): void {
    const highPriority = EventPriorityLevel.ACTION_TRIGGER + 1;

    // Span 管理类事件 - 高优先级，确保在所有效果事件之前开启 Span
    this._addSubscriber(eventBus, 'BattleInitEvent', (e: BattleInitEvent) => {
      this._aggregator.beginBattleInitSpan(e.player, e.opponent);
    }, highPriority);

    this._addSubscriber(eventBus, 'RoundStartEvent', (e: RoundStartEvent) => {
      this._aggregator.beginRoundStartSpan(e.turn);
    }, highPriority);

    this._addSubscriber(eventBus, 'ActionPreEvent', (e: ActionPreEvent) => {
      this._aggregator.beginActionPreSpan(e.caster);
    }, highPriority);

    this._addSubscriber(eventBus, 'ActionEvent', (e: ActionEvent) => {
      // ActionEvent 作为行动开始的兜底（主要用于普攻，因为普攻可能没有 SkillCastEvent）
      this._aggregator.beginActionSpan(e.caster, { id: 'basic_attack', name: '攻击' } as any);
    });

    this._addSubscriber(eventBus, 'SkillCastEvent', (e: SkillCastEvent) => {
      this._aggregator.beginActionSpan(e.caster, e.ability);
      this._onSkillCast(e);
    }, highPriority);

    this._addSubscriber(eventBus, 'BattleEndEvent', (e: BattleEndEvent) => {
        // TODO: winner name to MinimalUnit
        const winnerObj = e.winner ? { id: e.winner, name: e.winner } : { id: 'draw', name: '平局' };
        this._aggregator.beginBattleEndSpan(winnerObj, e.turns);
    });

    // 日志条目类事件 - 默认 COMBAT_LOG 优先级
    this._addSubscriber(eventBus, 'DamageTakenEvent', (e) => this._onDamageTaken(e));
    this._addSubscriber(eventBus, 'HealEvent', (e) => this._onHeal(e));
    this._addSubscriber(eventBus, 'ShieldEvent', (e) => this._onShield(e));
    this._addSubscriber(eventBus, 'BuffAppliedEvent', (e) => this._onBuffApplied(e));
    this._addSubscriber(eventBus, 'BuffRemovedEvent', (e) => this._onBuffRemoved(e));
    this._addSubscriber(eventBus, 'BuffImmuneEvent', (e) => this._onBuffImmune(e));
    this._addSubscriber(eventBus, 'HitCheckEvent', (e) => this._onHitCheck(e));
    this._addSubscriber(eventBus, 'SkillInterruptEvent', (e) => this._onSkillInterrupt(e));
    this._addSubscriber(eventBus, 'UnitDeadEvent', (e) => this._onUnitDead(e));
    this._addSubscriber(eventBus, 'ManaBurnEvent', (e) => this._onManaBurn(e));
    this._addSubscriber(eventBus, 'CooldownModifyEvent', (e) => this._onCooldownModify(e));
    this._addSubscriber(eventBus, 'ResourceDrainEvent', (e) => this._onResourceDrain(e));
    this._addSubscriber(eventBus, 'ReflectEvent', (e) => this._onReflect(e));
    this._addSubscriber(eventBus, 'DispelEvent', (e) => this._onDispel(e));
    this._addSubscriber(eventBus, 'TagTriggerEvent', (e) => this._onTagTrigger(e));
    this._addSubscriber(eventBus, 'DeathPreventEvent', (e) => this._onDeathPrevent(e));
  }

  /**
   * 取消订阅
   */
  unsubscribe(eventBus: EventBus): void {
    for (const [type, handler] of this._handlers) {
      eventBus.unsubscribe(type, handler);
    }
    this._handlers.clear();
  }

  // ===== 事件处理器 =====

  private _addSubscriber(
    eventBus: EventBus,
    type: string,
    handler: (e: any) => void,
    priority: number = EventPriorityLevel.COMBAT_LOG
  ): void {
    eventBus.subscribe(type, handler, priority);
    this._handlers.set(type, handler);
  }

  private _onDamageTaken(event: DamageTakenEvent): void {
    const damage = Math.round(event.damageTaken);
    const remainHp = Math.round(event.remainHealth);
    const critText = event.isCritical ? '（暴击！）' : '';
    
    let shieldText = '';
    if (event.shieldAbsorbed && event.shieldAbsorbed > 0) {
      const absorbed = Math.round(event.shieldAbsorbed);
      const remainShield = Math.round(event.remainShield || 0);
      shieldText = `（-${absorbed}点护盾${remainShield <= 0 ? '，护盾已破碎' : `，护盾剩余${remainShield}`}）`;
    }

    let message = '';
    if (event.buff) {
      message = `【持续伤害】${event.target.name}身上的「${event.buff.name}」发作，造成${damage}点伤害${shieldText}，剩余气血${remainHp}！`;
    } else {
      const casterName = event.caster?.name ?? '神秘力量';
      const abilityName = event.ability?.name ?? '攻击';
      message = `【伤害】${casterName}使用【${abilityName}】对${event.target.name}造成${damage}点伤害${shieldText}${critText}，剩余气血${remainHp}！`;
    }

    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'damage',
      data: {
        value: damage,
        remainHp,
        isCritical: event.isCritical,
        targetName: event.target.name,
        ...(event.buff ? { sourceBuff: event.buff.name } : {}),
      },
      message,
      highlight: event.isCritical || event.isLethal,
    });

    if (event.isLethal) {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'death',
        data: { target: event.target.name },
        message: `【击杀】${event.target.name}气血耗尽，被击败！`,
        highlight: true,
      });
    }
  }

  private _onHeal(event: HealEvent): void {
    const amount = Math.round(event.healAmount);
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'heal',
      data: { value: amount },
      message: `【治疗】${event.caster.name}使用【${event.ability?.name ?? '治疗'}】为${event.target.name}恢复了${amount}点气血，剩余气血${Math.round(event.target.currentHp)}！`,
      highlight: true,
    });
  }

  private _onBuffApplied(event: BuffAppliedEvent): void {
    const buff = event.buff;
    const duration = buff.getMaxDuration();
    const durationText = duration > 0 ? `（${duration}回合）` : '';
    const typeLabel = buff.type === 'buff' ? '【增益】' : buff.type === 'debuff' ? '【减益】' : '【效果】';

    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'buff_apply',
      data: {
        buff: buff.name,
        buffName: buff.name,
        targetName: event.target.name,
        type: buff.type,
      },
      message: `${typeLabel}${event.target.name} 获得「${buff.name}」${durationText}`,
      highlight: buff.type === 'buff',
    });
  }

  private _onBuffRemoved(event: BuffRemovedEvent): void {
    const buff = event.buff;
    const reasonText = {
      manual: '被移除',
      expired: '时效已过',
      dispel: '被驱散',
      replace: '被覆盖',
    }[event.reason];

    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'buff_remove',
      data: { buff: buff.name, reason: event.reason },
      message: `【效果消散】${event.target.name} 的「${buff.name}」已${reasonText}`,
      highlight: false,
    });
  }

  private _onBuffImmune(event: BuffImmuneEvent): void {
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'buff_immune',
      data: { buff: event.buff.name },
      message: `【免疫】${event.target.name} 拥有免疫能力，抵抗了「${event.buff.name}」！`,
      highlight: true,
    });
  }

  private _onHitCheck(event: HitCheckEvent): void {
    if (event.isDodged) {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'dodge',
        data: {},
        message: `【闪避】${event.target.name}身法灵动，轻松躲开了${event.caster.name}的【${event.ability.name}】！`,
        highlight: false,
      });
    } else if (event.isResisted) {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'resist',
        data: {},
        message: `【抵抗】${event.target.name}神识稳固，硬生生抵抗了${event.caster.name}的【${event.ability.name}】！`,
        highlight: false,
      });
    }
  }

  private _onSkillCast(event: SkillCastEvent): void {
    if (event.ability.id === 'basic_attack') return;
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'skill_cast',
      data: { skill: event.ability.name },
      message: `【施法】${event.caster.name}运转周身灵力，使出了【${event.ability.name}】！`,
      highlight: false,
    });
  }

  private _onSkillInterrupt(event: SkillInterruptEvent): void {
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'skill_interrupt',
      data: { skill: event.ability.name, reason: event.reason },
      message: `【打断】${event.caster.name}的【${event.ability.name}】被打断：${event.reason}！`,
      highlight: true,
    });
  }

  private _onUnitDead(event: UnitDeadEvent): void {
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'death',
      data: { unit: event.unit.name, killer: event.killer?.name },
      message: `【阵亡】${event.unit.name}已被${event.killer?.name ?? '神秘力量'}击败！`,
      highlight: true,
    });
  }

  private _onManaBurn(event: ManaBurnEvent): void {
    const amount = Math.round(event.burnAmount);
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'mana_burn',
      data: { value: amount },
      message: `【焚元】${event.caster.name}使用【${event.ability?.name ?? '削减'}】削减了${event.target.name}${amount}点真元！`,
      highlight: true,
    });
  }

  private _onShield(event: ShieldEvent): void {
    const amount = Math.round(event.shieldAmount);
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'shield',
      data: { value: amount },
      message: `【护盾】${event.caster.name}使用【${event.ability?.name ?? '护盾'}】为${event.target.name}施加了${amount}点护盾！`,
      highlight: true,
    });
  }

  private _onCooldownModify(event: CooldownModifyEvent): void {
    const action = event.cdModifyValue > 0 ? '增加' : '减少';
    const absValue = Math.abs(event.cdModifyValue);
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'cooldown_modify',
      data: { value: event.cdModifyValue },
      message: `【时序】${event.caster.name}使用【${event.ability?.name ?? '时序'}】使${event.target.name}的【${event.affectedAbilityName}】冷却${action}${absValue}回合！`,
      highlight: true,
    });
  }

  private _onResourceDrain(event: ResourceDrainEvent): void {
    const typeText = event.drainType === 'hp' ? '气血' : '真元';
    const amount = Math.round(event.amount);
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'resource_drain',
      data: { type: event.drainType, value: amount },
      message: `【掠夺】${event.caster.name}使用【${event.ability?.name ?? '掠夺'}】从${event.target.name}身上夺取了${amount}点${typeText}！`,
      highlight: true,
    });
  }

  private _onReflect(event: ReflectEvent): void {
    const amount = Math.round(event.reflectAmount);
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'reflect',
      data: { value: amount },
      message: `【反伤】${event.caster.name}使用【${event.ability?.name ?? '反弹'}】将${amount}点伤害反弹给了${event.target.name}！`,
      highlight: true,
    });
  }

  private _onDispel(event: DispelEvent): void {
    const buffsText = event.removedBuffNames.map((n) => `「${n}」`).join('、');
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'dispel',
      data: { buffs: event.removedBuffNames },
      message: `【驱散】${event.caster.name}使用【${event.ability?.name ?? '净化'}】清除了${event.target.name}身上的${buffsText}！`,
      highlight: true,
    });
  }

  private _onTagTrigger(event: TagTriggerEvent): void {
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'tag_trigger',
      data: { tag: event.tag },
      message: `【触发】${event.caster.name}使用【${event.ability?.name ?? '触发'}】触发了${event.target.name}身上的「${event.tag}」标记！`,
      highlight: true,
    });
  }

  private _onDeathPrevent(event: DeathPreventEvent): void {
    this._aggregator.addEntry({
      id: this._generateId(),
      type: 'death_prevent',
      data: {},
      message: `【免死】${event.target.name}触发了【${event.ability?.name ?? '免死效果'}】，在致命一击下保住了性命！`,
      highlight: true,
    });
  }

  private _generateId(): string {
    return `entry_${this._nextEntryId++}_${Date.now()}`;
  }
}
