import { CombatEvent, EventPriority } from './types';

type EventHandler<T extends CombatEvent> = (event: T) => void;

interface EventSubscriber {
  handler: EventHandler<any>;
  priority: EventPriority;
}

export class EventBus {
  private static _instance: EventBus;

  public static get instance(): EventBus {
    if (!this._instance) {
      this._instance = new EventBus();
    }
    return this._instance;
  }

  private _subscribers = new Map<string, EventSubscriber[]>();
  private _eventHistory: CombatEvent[] = [];
  private readonly _maxHistorySize = 1000;

  private constructor() {}

  public subscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: EventPriority = 0,
  ): void {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }

    const subscribers = this._subscribers.get(eventType)!;
    subscribers.push({ handler, priority });

    subscribers.sort((a, b) => b.priority - a.priority);
  }

  public unsubscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const subscribers = this._subscribers.get(eventType);
    if (!subscribers) return;

    this._subscribers.set(
      eventType,
      subscribers.filter((s) => s.handler !== handler),
    );
  }

  public publish<T extends CombatEvent>(event: T): void {
    this._eventHistory.push(event);
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory.shift();
    }

    const subscribers = this._subscribers.get(event.type);
    if (!subscribers) return;

    for (const subscriber of subscribers) {
      subscriber.handler(event);
    }
  }

  public getEventHistory(): ReadonlyArray<CombatEvent> {
    return this._eventHistory;
  }

  public clearHistory(): void {
    this._eventHistory = [];
  }

  public reset(): void {
    this._subscribers.clear();
    this._eventHistory = [];
  }
}
