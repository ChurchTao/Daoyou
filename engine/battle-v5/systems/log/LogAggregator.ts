import { LogEntry, LogSpan, LogSpanType } from './types';

/**
 * LogAggregator 职责：管理 Span 生命周期，聚合 LogEntry。
 */
export class LogAggregator {
  private _spans: LogSpan[] = [];
  private _activeSpan: LogSpan | null = null;
  private _turn: number = 0;
  private _spanCounter: number = 0;

  /**
   * 获取当前回合数
   */
  get currentTurn(): number {
    return this._turn;
  }

  /**
   * 开启新的 Span
   * @param type Span 类型
   * @param options 选项：turn, actor, ability
   */
  beginSpan(
    type: LogSpanType,
    options: {
      turn: number;
      actor?: { id: string; name: string };
      ability?: { id: string; name: string };
    }
  ): void {
    // 自动结束前一个 Span
    this._activeSpan = null;

    this._turn = options.turn;

    const span: LogSpan = {
      id: `span_${++this._spanCounter}_${Date.now()}`,
      type,
      turn: options.turn,
      actor: options.actor,
      ability: options.ability,
      entries: [],
      timestamp: Date.now(),
    };

    this._spans.push(span);
    this._activeSpan = span;
  }

  /**
   * 添加日志条目到当前活跃 Span
   */
  addEntry(entry: LogEntry): void {
    if (!this._activeSpan) {
      console.warn('[LogAggregator] No active span, entry dropped:', entry.type);
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
