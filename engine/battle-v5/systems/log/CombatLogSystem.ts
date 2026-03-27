import { EventBus } from '../../core/EventBus';
import { CombatPhase, CombatLog } from '../../core/types';
import { LogCollector } from './LogCollector';
import { LogAggregator } from './LogAggregator';
import { LogPresenter } from './LogPresenter';
import { LogSpan, LogSpanType, DamageEntryData } from './types';

/**
 * CombatLogSystem Facade
 * 门面类，协调 LogCollector、LogAggregator、LogPresenter。
 */
export class CombatLogSystem {
  private _collector: LogCollector;
  private _agg: LogAggregator;
  private _presenter: LogPresenter;

  /**
   * 内部 handlers（仅供测试使用）
   * @internal
   */
  get handlers(): Map<string, (event: unknown) => void> {
    return this._collector.handlers;
  }

  constructor() {
    this._agg = new LogAggregator();
    this._collector = new LogCollector(this._agg);
    this._presenter = new LogPresenter();
  }

  /**
   * 订阅事件总线
   */
  subscribe(eventBus: EventBus): void {
    this._collector.subscribe(eventBus);
  }

  /**
   * 取消订阅事件总线
   */
  unsubscribe(eventBus: EventBus): void {
    this._collector.unsubscribe(eventBus);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this._agg.clear();
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    this._collector.unsubscribe(EventBus.instance);
  }

  // ===== 新 API =====

  /**
   * 获取玩家日志（聚合后单行输出）
   */
  getPlayerLogs(): string[] {
    return this._presenter.getPlayerView(this._agg.getSpans());
  }

  /**
   * 获取 AI 数据（结构化 + 描述）
   */
  getAIData() {
    return this._presenter.getAIView(this._agg.getSpans());
  }

  /**
   * 获取调试数据
   */
  getDebugData() {
    return this._presenter.getDebugView(this._agg.getSpans());
  }

  /**
   * 获取所有 Span
   */
  getSpans(): LogSpan[] {
    return this._agg.getSpans();
  }

  // ===== 内部方法（供测试使用）=====

  /**
   * 获取内部 Aggregator（仅供测试使用）
   * @internal
   */
  get aggregator(): LogAggregator {
    return this._agg;
  }

  // ===== 兼容旧 API =====

  /**
   * @deprecated 使用 getPlayerLogs() 代替
   */
  getLogs(): CombatLog[] {
    const logs: CombatLog[] = [];
    for (const span of this._agg.getSpans()) {
      if (span.entries.length === 0 && !this._isStructuralSpan(span)) continue;

      const message = this._presenter.formatSpan(span);
      if (!message) continue;

      logs.push({
        turn: span.turn,
        phase: this._mapSpanTypeToPhase(span.type),
        message,
        highlight: this._hasHighlightEntry(span),
      });
    }
    return logs;
  }

  /**
   * @deprecated 使用 getPlayerLogs().join('\n') 代替
   */
  generateReport(): string {
    return this.getPlayerLogs().join('\n');
  }

  /**
   * @deprecated 使用 getPlayerLogs().filter(...) 代替
   */
  getSimpleLogs(): CombatLog[] {
    return this.getLogs().filter((log) => log.highlight);
  }

  /**
   * @deprecated 不再需要手动调用
   */
  log(_turn: number, _phase: CombatPhase, _message: string): void {
    // 兼容方法：不再使用，参数保留用于签名兼容
  }

  /**
   * @deprecated 不再需要手动调用
   */
  logHighlight(_turn: number, _message: string): void {
    // 兼容方法：不再使用，参数保留用于签名兼容
  }

  /**
   * @deprecated 使用 getAIData() 代替
   */
  getResult() {
    const spans = this._agg.getSpans();
    const fullText = this._presenter.getPlayerView(spans).join('\n');

    return {
      battleId: '',
      spans,
      fullText,
      metadata: {
        winner: '',
        loser: '',
        turns: spans.length > 0 ? spans[spans.length - 1].turn : 0,
        duration: 0,
      },
    };
  }

  /**
   * @deprecated 使用 unsubscribe + clear 代替
   */
  logBattleEnd(winnerName: string, turns: number): void {
    this._agg.beginSpan('battle_end', {
      turn: turns,
      actor: { id: winnerName, name: winnerName },
    });
  }

  /**
   * @deprecated 不再支持
   */
  setSimpleMode(_enabled: boolean): void {
    // 不再支持，参数保留用于签名兼容
  }

  private _isStructuralSpan(span: LogSpan): boolean {
    return ['battle_init', 'round_start', 'battle_end'].includes(span.type);
  }

  private _mapSpanTypeToPhase(type: LogSpanType): CombatPhase {
    const mapping: Record<LogSpanType, CombatPhase> = {
      battle_init: CombatPhase.INIT,
      round_start: CombatPhase.ROUND_START,
      action_pre: CombatPhase.ROUND_PRE,
      action: CombatPhase.ACTION,
      battle_end: CombatPhase.END,
    };
    return mapping[type] ?? CombatPhase.ROUND_PRE;
  }

  private _hasHighlightEntry(span: LogSpan): boolean {
    return span.entries.some(
      (e) =>
        ['death', 'death_prevent', 'skill_interrupt'].includes(e.type) ||
        (e.type === 'damage' && (e.data as DamageEntryData).isCritical)
    );
  }
}
