import type { TeamBattleInternalEvent } from './types';

type Handler = (event: TeamBattleInternalEvent) => void;

/**
 * 实例级事件总线（非单例）。
 *
 * 每个 TeamBattleEngine 实例 new 一个，避免污染 battle-v5 的 EventBus 单例。
 * abilities 在 onBattleStart 时订阅，onDestroy 时取消。
 */
export class TeamBattleEventBus {
  private handlers = new Map<string, Handler[]>();

  subscribe(type: string, handler: Handler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => this.unsubscribe(type, handler);
  }

  emit(event: TeamBattleInternalEvent): void {
    const list = this.handlers.get(event.type);
    if (!list) return;
    for (const handler of [...list]) {
      handler(event);
    }
  }

  clear(): void {
    this.handlers.clear();
  }

  private unsubscribe(type: string, handler: Handler): void {
    const list = this.handlers.get(type);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) this.handlers.delete(type);
  }
}
