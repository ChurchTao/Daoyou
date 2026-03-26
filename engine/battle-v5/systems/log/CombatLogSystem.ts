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
      return (this._subscriber as any)._handlers;
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
      let phase: CombatPhase;
      switch (span.type) {
        case 'battle_init':
          phase = CombatPhase.INIT;
          break;
        case 'round_start':
          phase = CombatPhase.ROUND_START;
          break;
        case 'action_pre':
          phase = CombatPhase.ROUND_PRE;
          break;
        case 'action':
          phase = CombatPhase.ACTION;
          break;
        case 'battle_end':
          phase = CombatPhase.END;
          break;
        default:
          phase = CombatPhase.ROUND_PRE;
      }

      logs.push({
        turn: span.turn,
        phase,
        message: this._formatter.formatSpan(span),
        highlight: span.entries.some((e) => e.highlight),
      });
    }
    return logs;
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
