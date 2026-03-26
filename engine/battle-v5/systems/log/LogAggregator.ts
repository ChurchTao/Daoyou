import { LogEntry, LogSpan, LogSpanType } from './types';

interface MinimalUnit {
  id: string;
  name: string;
}

interface MinimalAbility {
  id: string;
  name: string;
}

/**
 * LogAggregator 职责：管理 Span 生命周期，聚合 LogEntry。
 */
export class LogAggregator {
  private _spans: LogSpan[] = [];
  private _activeSpan: LogSpan | null = null;
  private _turn: number = 0;
  private _spanCounter: number = 0;

  // ===== Span 生命周期 =====

  /**
   * 开启行动前置 Span（DOT/持续效果触发）
   */
  beginActionPreSpan(unit: MinimalUnit): void {
    this._startSpan('action_pre', `持续效果触发：${unit.name}`, {
      id: unit.id,
      name: unit.name,
    });
  }

  /**
   * 开启主动行动 Span
   */
  beginActionSpan(caster: MinimalUnit, ability: MinimalAbility): void {
    const isBasicAttack = ability.id === 'basic_attack';
    const title = isBasicAttack
      ? `${caster.name} 行动`
      : `${caster.name} 施放【${ability.name}】`;
    
    this._startSpan('action', title, {
      id: caster.id,
      name: caster.name,
    });
  }

  /**
   * 开启回合开始 Span
   */
  beginRoundStartSpan(turn: number): void {
    this._turn = turn;
    this._startSpan('round_start', `第 ${turn} 回合开始`);
  }

  /**
   * 开启战斗初始化 Span
   */
  beginBattleInitSpan(player: MinimalUnit, opponent: MinimalUnit): void {
    this._startSpan('battle_init', `战斗开始：${player.name} VS ${opponent.name}`);
  }

  /**
   * 开启战斗结束 Span
   */
  beginBattleEndSpan(winner: MinimalUnit, turns: number): void {
    this._startSpan('battle_end', `战斗结束：${winner.name} 获胜！`);
  }

  /**
   * 添加日志条目到当前活跃 Span
   */
  addEntry(entry: LogEntry): void {
    if (!this._activeSpan) {
      // 如果没有活跃 Span，且当前不是系统 Span，则可能丢失日志或创建一个临时 Span
      // 目前策略：忽略无 Span 的日志条目，因为所有战斗事件都应该在某个 Span 内
      return;
    }
    this._activeSpan.entries.push(entry);
  }

  /**
   * 显式结束当前 Span
   */
  endSpan(): void {
    this._activeSpan = null;
  }

  // ===== 私有方法 =====

  private _startSpan(
    type: LogSpanType,
    title: string,
    source?: { id: string; name: string }
  ): void {
    // 自动结束前一个活跃 Span
    this.endSpan();

    const span: LogSpan = {
      id: `span_${++this._spanCounter}_${Date.now()}`,
      type,
      turn: this._turn,
      source,
      title,
      entries: [],
      timestamp: Date.now(),
    };

    this._spans.push(span);
    this._activeSpan = span;
  }

  // ===== 查询接口 =====

  /**
   * 获取所有 Span
   */
  getSpans(): LogSpan[] {
    return [...this._spans];
  }

  /**
   * 按回合获取 Span
   */
  getSpansByTurn(turn: number): LogSpan[] {
    return this._spans.filter((s) => s.turn === turn);
  }

  /**
   * 清空所有日志
   */
  clear(): void {
    this._spans = [];
    this._activeSpan = null;
    this._turn = 0;
    this._spanCounter = 0;
  }
}
