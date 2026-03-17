import { CombatEvent, EventPriority } from './types';

type EventHandler<T extends CombatEvent> = (event: T) => void;

interface EventSubscriber {
  wrappedHandler: (event: CombatEvent) => void;
  priority: EventPriority;
}

/**
 * Event Bus for combat event management
 * Uses priority queue for event processing
 * Singleton pattern for global access
 */
export class EventBus {
  private static _instance: EventBus;
  private static readonly DEFAULT_MAX_HISTORY_SIZE = 1000;

  public static get instance(): EventBus {
    if (!this._instance) {
      this._instance = new EventBus();
    }
    return this._instance;
  }

  private _subscribers = new Map<string, EventSubscriber[]>();
  private _eventHistory: CombatEvent[] = [];
  private readonly _maxHistorySize = EventBus.DEFAULT_MAX_HISTORY_SIZE;

  private constructor() {}

  /**
   * Subscribe to an event type with handler and optional priority
   * Higher priority handlers execute first
   * Same priority handlers execute in insertion order
   */
  public subscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: EventPriority = 0,
  ): void {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }

    const subscribers = this._subscribers.get(eventType)!;
    // Wrap handler to accept CombatEvent base type
    const wrappedHandler: (event: CombatEvent) => void = handler as EventHandler<CombatEvent>;

    subscribers.push({ wrappedHandler, priority });

    subscribers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Unsubscribe a handler from an event type
   */
  public unsubscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const subscribers = this._subscribers.get(eventType);
    if (!subscribers) return;

    // Filter by comparing wrapped handlers
    const wrappedHandler = handler as EventHandler<CombatEvent>;
    this._subscribers.set(
      eventType,
      subscribers.filter((s) => s.wrappedHandler !== wrappedHandler),
    );
  }

  /**
   * Publish an event to all subscribers
   * Automatically sets timestamp if not provided
   */
  public publish<T extends CombatEvent>(event: T): void {
    // Automatically set timestamp if not provided
    const eventWithTimestamp = event.timestamp !== undefined
      ? event
      : { ...event, timestamp: Date.now() } as T;

    this._eventHistory.push(eventWithTimestamp);
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory.shift();
    }

    const subscribers = this._subscribers.get(event.type);
    if (!subscribers) return;

    for (const subscriber of subscribers) {
      subscriber.wrappedHandler(eventWithTimestamp);
    }
  }

  /**
   * Get readonly event history
   */
  public getEventHistory(): ReadonlyArray<CombatEvent> {
    return this._eventHistory;
  }

  /**
   * Clear event history
   */
  public clearHistory(): void {
    this._eventHistory = [];
  }

  /**
   * Reset all subscribers and event history
   */
  public reset(): void {
    this._subscribers.clear();
    this._eventHistory = [];
  }
}
