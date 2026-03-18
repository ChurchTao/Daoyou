import { CombatPhase, CombatLog } from '../core/types';
import { EventBus } from '../core/EventBus';
import {
  SkillInterruptEvent,
  HitCheckEvent,
  DamageTakenEvent,
  UnitDeadEvent,
  EventPriorityLevel,
} from '../core/events';

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
    const interruptHandler = (e: SkillInterruptEvent) => this._onSkillInterrupt(e);
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
  }

  private _onSkillInterrupt(event: SkillInterruptEvent): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0, // TODO: 从上下文获取当前回合
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

    this._addLog({
      id: `log_${this._nextId++}`,
      turn: 0, // TODO: 从上下文获取当前回合
      phase: CombatPhase.ACTION,
      message: `【伤害】${event.caster.name}使用【${event.ability.name}】对${event.target.name}造成${event.damageTaken}点伤害${critText}，剩余气血${event.remainHealth}！`,
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
      message: `【阵亡】${event.unit.name}已被${event.killer.name}击败！`,
      highlight: true,
    });
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
    const message = `${attackerName} 对 ${targetName} 造成了 ${damage} 点伤害${critText}`;
    this.log(turn, CombatPhase.ACTION, message);
  }

  /**
   * 记录治疗
   */
  logHeal(turn: number, casterName: string, targetName: string, amount: number): void {
    const message = `${casterName} 为 ${targetName} 恢复了 ${amount} 点气血`;
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
