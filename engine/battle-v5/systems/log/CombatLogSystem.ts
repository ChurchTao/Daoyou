import { EventBus } from '../../core/EventBus';
import { LogCollector } from './LogCollector';
import { LogAggregator } from './LogAggregator';
import { LogPresenter } from './LogPresenter';
import { LogSpan } from './types';

/**
 * CombatLogSystem Facade
 * 门面类，协调 LogCollector、LogAggregator、LogPresenter。
 */
export class CombatLogSystem {
  private _collector: LogCollector;
  private _agg: LogAggregator;
  private _presenter: LogPresenter;

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

  // ===== 核心 API =====

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

}
