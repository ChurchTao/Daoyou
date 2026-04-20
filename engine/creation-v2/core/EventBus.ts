import { CreationEvent, CreationEventPriority } from './types';

type EventHandler<T extends CreationEvent> = (event: T) => void;

interface EventSubscriber {
  wrappedHandler: (event: CreationEvent) => void;
  priority: CreationEventPriority;
}

/*
 * CreationEventBus: 同步事件总线（轻量版）。
 * 特性：
 *  - 支持按事件类型订阅/退订（subscribe/unsubscribe）
 *  - 支持订阅者优先级（priority），高优先级先执行
 *  - 维护事件历史（eventHistory）与待处理事件队列（pendingEvents）
 *  - 发布时防止递归/重入（isPublishing 标志）
 * 用途：在编排层与各阶段处理器之间广播 CreationDomainEvent，作为工作流驱动的核心通信机制。
 */
export class CreationEventBus {
  private readonly subscribers = new Map<string, EventSubscriber[]>();
  private readonly eventHistory: CreationEvent[] = [];
  private readonly pendingEvents: CreationEvent[] = [];
  private isPublishing = false;

  constructor(private readonly maxHistorySize = 500) {}

  subscribe<T extends CreationEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: CreationEventPriority = 0,
  ): EventHandler<T> {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const wrappedHandler = handler as EventHandler<CreationEvent>;
    const subscribers = this.subscribers.get(eventType)!;

    subscribers.push({ wrappedHandler, priority });
    subscribers.sort((left, right) => right.priority - left.priority);

    return handler;
  }

  unsubscribe<T extends CreationEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const subscribers = this.subscribers.get(eventType);
    if (!subscribers) {
      return;
    }

    const wrappedHandler = handler as EventHandler<CreationEvent>;
    const filtered = subscribers.filter(
      (subscriber) => subscriber.wrappedHandler !== wrappedHandler,
    );

    if (filtered.length === 0) {
      this.subscribers.delete(eventType);
      return;
    }

    this.subscribers.set(eventType, filtered);
  }

  publish<T extends CreationEvent>(event: T): void {
    const eventWithTimestamp = event.timestamp
      ? event
      : ({ ...event, timestamp: Date.now() } as T);

    this.pendingEvents.push(eventWithTimestamp);
    if (this.isPublishing) {
      return;
    }

    this.isPublishing = true;

    while (this.pendingEvents.length > 0) {
      const currentEvent = this.pendingEvents.shift()!;

      this.eventHistory.push(currentEvent);
      if (this.eventHistory.length > this.maxHistorySize) {
        this.eventHistory.shift();
      }

      const subscribers = this.subscribers.get(currentEvent.type);
      if (!subscribers) {
        continue;
      }

      for (const subscriber of subscribers) {
        subscriber.wrappedHandler(currentEvent);
      }
    }

    this.isPublishing = false;
  }

  getEventHistory(): ReadonlyArray<CreationEvent> {
    return this.eventHistory;
  }

  reset(): void {
    this.subscribers.clear();
    this.eventHistory.length = 0;
    this.pendingEvents.length = 0;
    this.isPublishing = false;
  }
}