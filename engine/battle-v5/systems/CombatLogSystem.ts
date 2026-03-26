import { EventBus } from '../core/EventBus';
import {
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
  SkillInterruptEvent,
  TagTriggerEvent,
  UnitDeadEvent,
} from '../core/events';
import { CombatLog, CombatPhase } from '../core/types';

/**
 * 战报条目
 */
interface CombatLogEntry extends CombatLog {
  id: string;
}

/**
 * 战报系统
 * 收集和管理战斗日志
 */
export class CombatLogSystem {
  private _logs: CombatLogEntry[] = [];
  private _nextId: number = 0;
  private _simpleMode: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 技能打断事件
    const interruptHandler = (e: SkillInterruptEvent) =>
      this._onSkillInterrupt(e);
    EventBus.instance.subscribe<SkillInterruptEvent>(
      'SkillInterruptEvent',
      interruptHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('SkillInterruptEvent', interruptHandler);

    // 命中判定事件（闪避/抵抗）
    const hitCheckHandler = (e: HitCheckEvent) => this._onHitCheck(e);
    EventBus.instance.subscribe<HitCheckEvent>(
      'HitCheckEvent',
      hitCheckHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('HitCheckEvent', hitCheckHandler);

    // 受击事件
    const damageTakenHandler = (e: DamageTakenEvent) => this._onDamageTaken(e);
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      damageTakenHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('DamageTakenEvent', damageTakenHandler);

    // 单元死亡事件
    const unitDeadHandler = (e: UnitDeadEvent) => this._onUnitDead(e);
    EventBus.instance.subscribe<UnitDeadEvent>(
      'UnitDeadEvent',
      unitDeadHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('UnitDeadEvent', unitDeadHandler);

    // BUFF 应用事件
    const buffAppliedHandler = (e: BuffAppliedEvent) => this._onBuffApplied(e);
    EventBus.instance.subscribe<BuffAppliedEvent>(
      'BuffAppliedEvent',
      buffAppliedHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('BuffAppliedEvent', buffAppliedHandler);

    // BUFF 移除事件
    const buffRemovedHandler = (e: BuffRemovedEvent) => this._onBuffRemoved(e);
    EventBus.instance.subscribe<BuffRemovedEvent>(
      'BuffRemovedEvent',
      buffRemovedHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('BuffRemovedEvent', buffRemovedHandler);

    // BUFF 免疫拦截事件
    const buffImmuneHandler = (e: BuffImmuneEvent) => this._onBuffImmune(e);
    EventBus.instance.subscribe<BuffImmuneEvent>(
      'BuffImmuneEvent',
      buffImmuneHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('BuffImmuneEvent', buffImmuneHandler);

    // 治疗事件
    const healHandler = (e: HealEvent) => this._onHeal(e);
    EventBus.instance.subscribe<HealEvent>(
      'HealEvent',
      healHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('HealEvent', healHandler);

    // 焚元事件
    const manaBurnHandler = (e: ManaBurnEvent) => this._onManaBurn(e);
    EventBus.instance.subscribe<ManaBurnEvent>(
      'ManaBurnEvent',
      manaBurnHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('ManaBurnEvent', manaBurnHandler);

    // 护盾事件
    const shieldHandler = (e: ShieldEvent) => this._onShield(e);
    EventBus.instance.subscribe<ShieldEvent>(
      'ShieldEvent',
      shieldHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('ShieldEvent', shieldHandler);

    // 冷却修改事件
    const cdHandler = (e: CooldownModifyEvent) => this._onCooldownModify(e);
    EventBus.instance.subscribe<CooldownModifyEvent>(
      'CooldownModifyEvent',
      cdHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('CooldownModifyEvent', cdHandler);

    // 资源夺取事件
    const drainHandler = (e: ResourceDrainEvent) => this._onResourceDrain(e);
    EventBus.instance.subscribe<ResourceDrainEvent>(
      'ResourceDrainEvent',
      drainHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('ResourceDrainEvent', drainHandler);

    // 反伤事件
    const reflectHandler = (e: ReflectEvent) => this._onReflect(e);
    EventBus.instance.subscribe<ReflectEvent>(
      'ReflectEvent',
      reflectHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('ReflectEvent', reflectHandler);

    // 驱散事件
    const dispelHandler = (e: DispelEvent) => this._onDispel(e);
    EventBus.instance.subscribe<DispelEvent>(
      'DispelEvent',
      dispelHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('DispelEvent', dispelHandler);

    // 标签触发事件
    const tagTriggerHandler = (e: TagTriggerEvent) => this._onTagTrigger(e);
    EventBus.instance.subscribe<TagTriggerEvent>(
      'TagTriggerEvent',
      tagTriggerHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('TagTriggerEvent', tagTriggerHandler);

    // 免死事件
    const deathPreventHandler = (e: DeathPreventEvent) =>
      this._onDeathPrevent(e);
    EventBus.instance.subscribe<DeathPreventEvent>(
      'DeathPreventEvent',
      deathPreventHandler,
      EventPriorityLevel.COMBAT_LOG,
    );
    this._handlers.set('DeathPreventEvent', deathPreventHandler);
  }

  private _onDeathPrevent(event: DeathPreventEvent): void {
    const abilityName = event.ability?.name ?? '特殊效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【免死】${event.target.name}触发了【${abilityName}】，在致命一击下保住了性命！`,
      highlight: true,
    });
  }

  private _onTagTrigger(event: TagTriggerEvent): void {
    const casterName = event.caster.name;
    const targetName = event.target.name;
    const abilityName = event.ability?.name ?? '触发效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【触发】${casterName}使用【${abilityName}】触发了${targetName}身上的「${event.tag}」标记！`,
      highlight: true,
    });
  }

  private _onDispel(event: DispelEvent): void {
    const casterName = event.caster.name;
    const targetName = event.target.name;
    const abilityName = event.ability?.name ?? '净化效果';
    const buffsText = event.removedBuffNames.map((n) => `「${n}」`).join('、');

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【驱散】${casterName}使用【${abilityName}】清除了${targetName}身上的${buffsText}！`,
      highlight: true,
    });
  }

  private _onReflect(event: ReflectEvent): void {
    const casterName = event.caster.name;
    const targetName = event.target.name;
    const abilityName = event.ability?.name ?? '反伤效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【反伤】${casterName}使用【${abilityName}】将${Math.round(event.reflectAmount)}点伤害反弹给了${targetName}！`,
      highlight: true,
    });
  }

  private _onResourceDrain(event: ResourceDrainEvent): void {
    const casterName = event.caster.name;
    const targetName = event.target.name;
    const abilityName = event.ability?.name ?? '掠夺效果';
    const typeText = event.drainType === 'hp' ? '气血' : '真元';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【掠夺】${casterName}使用【${abilityName}】从${targetName}身上夺取了${Math.round(event.amount)}点${typeText}！`,
      highlight: true,
    });
  }

  private _onCooldownModify(event: CooldownModifyEvent): void {
    const casterName = event.caster.name;
    const abilityName = event.ability?.name ?? '时序效果';
    const action = event.cdModifyValue > 0 ? '增加' : '减少';
    const absValue = Math.abs(event.cdModifyValue);

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【时序】${casterName}使用【${abilityName}】使${event.target.name}的【${event.affectedAbilityName}】冷却${action}${absValue}回合！`,
      highlight: true,
    });
  }

  private _onShield(event: ShieldEvent): void {
    const shieldAmount = Math.round(event.shieldAmount);
    const casterName = event.caster.name;
    const abilityName = event.ability?.name ?? '护盾效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【护盾】${casterName}使用【${abilityName}】为${event.target.name}施加了${shieldAmount}点护盾！`,
      highlight: true,
    });
  }

  private _onHeal(event: HealEvent): void {
    const healAmount = Math.round(event.healAmount);
    const casterName = event.caster.name;
    const abilityName = event.ability?.name ?? '治疗效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【治疗】${casterName}使用【${abilityName}】为${event.target.name}恢复了${healAmount}点气血，剩余气血${Math.round(event.target.currentHp)}！`,
      highlight: true,
    });
  }

  private _onManaBurn(event: ManaBurnEvent): void {
    const burnAmount = Math.round(event.burnAmount);
    const casterName = event.caster.name;
    const abilityName = event.ability?.name ?? '削减效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【焚元】${casterName}使用【${abilityName}】削减了${event.target.name}${burnAmount}点真元！`,
      highlight: true,
    });
  }

  private _onSkillInterrupt(event: SkillInterruptEvent): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0, // 回合信息由外部日志调用时设置
      phase: CombatPhase.ACTION,
      message: `【打断】${event.caster.name}的【${event.ability.name}】被打断！`,
      highlight: true,
    });
  }

  private _onHitCheck(event: HitCheckEvent): void {
    if (event.isDodged) {
      this._addLog({
        id: `log_${this._nextId++}`,
        turn: 0,
        phase: CombatPhase.ACTION,
        message: `【闪避】${event.target.name}身法灵动，躲开了${event.caster.name}的【${event.ability.name}】！`,
        highlight: false,
      });
    } else if (event.isResisted) {
      this._addLog({
        id: `log_${this._nextId++}`,
        turn: 0,
        phase: CombatPhase.ACTION,
        message: `【抵抗】${event.target.name}神识稳固，抵抗了${event.caster.name}的【${event.ability.name}】！`,
        highlight: false,
      });
    }
  }

  private _onDamageTaken(event: DamageTakenEvent): void {
    const critText = event.isCritical ? '（暴击！）' : '';
    const highlight = event.isCritical || false;
    // 格式化数字为整数
    const damage = Math.round(event.damageTaken);
    const remainHp = Math.round(event.remainHealth);

    let shieldText = '';
    // 处理护盾日志
    if (event.shieldAbsorbed && event.shieldAbsorbed > 0) {
      const shieldAbsorbed = Math.round(event.shieldAbsorbed);
      const remainShield = Math.round(event.remainShield || 0);
      const breakText =
        remainShield <= 0 ? '，护盾已破碎' : `，护盾剩余${remainShield}`;
      shieldText = `（-${shieldAbsorbed}点护盾${breakText}）`;
    }

    // 处理可能的 null 值（DOT 伤害等情况）
    const casterName = event.caster?.name ?? '持续伤害';
    const abilityName = event.ability?.name ?? '持续效果';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0, // 回合信息由外部日志调用时设置
      phase: CombatPhase.ACTION,
      message: `【伤害】${casterName}使用【${abilityName}】对${event.target.name}造成${damage}点伤害${shieldText}${critText}，剩余气血${remainHp}！`,
      highlight,
    });

    if (event.isLethal) {
      this._addLog({
        id: `log_${this._nextId++}`,
        turn: 0,
        phase: CombatPhase.ACTION,
        message: `【击杀】${event.target.name}气血耗尽，被击败！`,
        highlight: true,
      });
    }
  }

  private _onUnitDead(event: UnitDeadEvent): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【阵亡】${event.unit.name}已被${event.killer?.name}击败！`,
      highlight: true,
    });
  }

  private _onBuffApplied(event: BuffAppliedEvent): void {
    const buffType = event.buff.type;
    const typeLabel =
      buffType === 'buff'
        ? '【增益】'
        : buffType === 'debuff'
          ? '【减益】'
          : '【效果】';
    const duration = event.buff.getMaxDuration();
    const durationText = duration > 0 ? `（${duration}回合）` : '';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ROUND_POST,
      message: `${typeLabel}${event.target.name} 获得「${event.buff.name}」${durationText}`,
      highlight: buffType === 'buff',
    });
  }

  private _onBuffRemoved(event: BuffRemovedEvent): void {
    const buffType = event.buff.type;
    const typeLabel =
      buffType === 'buff'
        ? '【增益消散】'
        : buffType === 'debuff'
          ? '【减益解除】'
          : '【效果消失】';

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ROUND_POST,
      message: `${typeLabel}${event.target.name} 的「${event.buff.name}」已${this._getRemoveReasonText(event.reason)}`,
      highlight: false,
    });
  }

  private _onBuffImmune(event: BuffImmuneEvent): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【免疫】${event.target.name} 拥有免疫能力，抵抗了「${event.buff.name}」！`,
      highlight: true,
    });
  }

  private _getRemoveReasonText(
    reason: 'manual' | 'expired' | 'dispel' | 'replace',
  ): string {
    const reasonMap = {
      manual: '被移除',
      expired: '时效已过',
      dispel: '被驱散',
      replace: '被覆盖',
    };
    return reasonMap[reason];
  }

  /**
   * 记录普通日志
   */
  log(turn: number, phase: CombatPhase, message: string): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn,
      phase,
      message,
      highlight: false,
    });
  }

  /**
   * 记录高光时刻
   */
  logHighlight(turn: number, message: string): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn,
      phase: CombatPhase.ACTION,
      message,
      highlight: true,
    });
  }

  /**
   * 记录伤害
   */
  logDamage(
    turn: number,
    attackerName: string,
    targetName: string,
    damage: number,
    isCritical: boolean,
  ): void {
    const critText = isCritical ? '（暴击！）' : '';
    const formattedDamage = Math.round(damage);
    const message = `${attackerName} 对 ${targetName} 造成了 ${formattedDamage} 点伤害${critText}`;
    this.log(turn, CombatPhase.ACTION, message);
  }

  /**
   * 记录治疗
   */
  logHeal(
    turn: number,
    casterName: string,
    targetName: string,
    amount: number,
  ): void {
    const formattedAmount = Math.round(amount);
    const message = `${casterName} 为 ${targetName} 恢复了 ${formattedAmount} 点气血`;
    this.log(turn, CombatPhase.ACTION, message);
  }

  /**
   * 记录 Buff 应用/移除
   */
  logBuff(
    turn: number,
    unitName: string,
    buffName: string,
    isApply: boolean,
  ): void {
    const action = isApply ? '获得了' : '失去了';
    const message = `${unitName} ${action} 「${buffName}」`;
    this.log(turn, CombatPhase.ROUND_POST, message);
  }

  /**
   * 记录战斗结束
   */
  logBattleEnd(winnerName: string, turns: number): void {
    this.logHighlight(turns, `✨ ${winnerName} 获胜！战斗持续 ${turns} 回合`);
  }

  /**
   * 获取所有日志
   */
  getLogs(): CombatLogEntry[] {
    return [...this._logs];
  }

  /**
   * 获取极简模式日志（仅高光时刻）
   */
  getSimpleLogs(): CombatLogEntry[] {
    return this._logs.filter((log) => log.highlight);
  }

  /**
   * 获取指定回合的日志
   */
  getLogsByTurn(turn: number): CombatLogEntry[] {
    return this._logs.filter((log) => log.turn === turn);
  }

  /**
   * 设置极简模式
   */
  setSimpleMode(enabled: boolean): void {
    this._simpleMode = enabled;
  }

  /**
   * 清空日志
   */
  clear(): void {
    this._logs = [];
    this._nextId = 0;
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

  /**
   * 生成格式化战报
   */
  generateReport(simple: boolean = false): string {
    const logs = simple ? this.getSimpleLogs() : this.getLogs();
    return logs
      .map((log) => {
        const phaseText = `[${log.phase}]`;
        const highlightMark = log.highlight ? '✨ ' : '';
        return `${highlightMark}[第${log.turn}回合] ${phaseText} ${log.message}`;
      })
      .join('\n');
  }

  private _addLog(entry: CombatLogEntry): void {
    this._logs.push(entry);
  }
}
