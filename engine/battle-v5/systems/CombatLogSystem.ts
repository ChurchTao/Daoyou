import { CombatPhase, CombatLog } from '../core/types';

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
