import { EventBus } from '../../core/EventBus';
import { CombatLog, CombatPhase } from '../../core/types';
import { LogAggregator } from './LogAggregator';
import { LogSubscriber } from './LogSubscriber';
import { LogFormatter, TextFormatter } from './LogFormatter';
import { CombatLogResult, LogSpan } from './types';

/**
 * CombatLogSystem Facade
 * 门面类，保持与旧 API 的兼容性，同时提供新的 Span 基于的能力。
 */
export class CombatLogSystem {
  private _aggregator: LogAggregator;
  private _subscriber: LogSubscriber;
  private _formatter: LogFormatter;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get _handlers(): Map<string, (event: any) => void> {
      return this._subscriber.handlers;
  }

  constructor() {
    this._aggregator = new LogAggregator();
    this._subscriber = new LogSubscriber(this._aggregator);
    this._formatter = new TextFormatter();
  }

  /**
   * 显式订阅事件总线
   */
  subscribe(eventBus: EventBus): void {
    this._subscriber.subscribe(eventBus);
  }

  /**
   * 取消订阅事件总线
   */
  unsubscribe(eventBus: EventBus): void {
    this._subscriber.unsubscribe(eventBus);
  }

  // ===== 兼容现有 API =====

  log(turn: number, phase: CombatPhase, message: string): void {
      // 兼容方法：创建一个通用的 entry
      this._aggregator.addEntry({
          id: `legacy_${Date.now()}`,
          type: 'damage', // 默认类型
          data: {},
          message,
          highlight: false
      });
  }

  logHighlight(turn: number, message: string): void {
      this._aggregator.addEntry({
          id: `legacy_h_${Date.now()}`,
          type: 'damage',
          data: {},
          message,
          highlight: true
      });
  }

  getLogs(): CombatLog[] {
    const logs: CombatLog[] = [];
    for (const span of this._aggregator.getSpans()) {
      // 核心改进：过滤掉没有内容的非核心 Span (如没有 DOT 触发的 action_pre)
      if (
        span.entries.length === 0 &&
        !['battle_init', 'round_start', 'battle_end'].includes(span.type)
      ) {
        continue;
      }

      const message = this._formatter.formatSpan(span);
      if (!message) continue;

      logs.push({
        turn: span.turn,
        phase: this._mapSpanTypeToPhase(span.type),
        message,
        highlight: span.entries.some((e) => e.highlight),
      });
    }
    return logs;
  }

  private _mapSpanTypeToPhase(type: string): CombatPhase {
    switch (type) {
      case 'battle_init':
        return CombatPhase.INIT;
      case 'round_start':
        return CombatPhase.ROUND_START;
      case 'action_pre':
        return CombatPhase.ROUND_PRE;
      case 'action':
        return CombatPhase.ACTION;
      case 'battle_end':
        return CombatPhase.END;
      default:
        return CombatPhase.ROUND_PRE;
    }
  }

  getSimpleLogs(): CombatLog[] {
      return this.getLogs().filter(log => log.highlight);
  }

  generateReport(simple: boolean = false): string {
      const result = this.getResult();
      if (simple) {
          // 这里可以后续优化 Simple 报告
          return result.fullText;
      }
      return result.fullText;
  }

  // ===== 新增 API =====

  getSpans(): LogSpan[] {
    return this._aggregator.getSpans();
  }

  getResult(): CombatLogResult {
    const spans = this._aggregator.getSpans();
    
    // 自动生成全文
    const fullText = this._formatter.formatResult({
        battleId: '',
        spans,
        fullText: '',
        metadata: { winner: '', loser: '', turns: 0, duration: 0 }
    });

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
   * 记录战斗结束
   */
  logBattleEnd(winnerName: string, turns: number): void {
      this._aggregator.beginBattleEndSpan({ id: winnerName, name: winnerName }, turns);
  }

  /**
   * 清空日志
   */
  clear(): void {
    this._aggregator.clear();
  }

  /**
   * 设置极简模式
   */
  setSimpleMode(enabled: boolean): void {
      // TODO: 实现极简模式过滤逻辑
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    this._subscriber.unsubscribe(EventBus.instance);
  }
}
