import type {
  CombatOriginV3,
  CombatSequenceScopeV3,
  CombatTraceV3,
  ResolvedCombatSequenceScopeV3,
} from '../v3/types';
import { CombatEvent, EventPriority } from './types';
import { SystemBattleClock, type BattleClock } from '../runtime/BattleClock';
import type { CombatResultCommittedEventV3 } from '../v3/events';
import { BattleResolutionError } from './BattleResolutionError';

interface CombatFactSink {
  record(event: CombatResultCommittedEventV3): void;
}

type EventHandler<T extends CombatEvent> = (event: T) => void;

interface EventSubscriber {
  wrappedHandler: (event: CombatEvent) => void;
  priority: EventPriority;
}

export interface EventBusCursorV1 {
  sequenceCounter: number;
  eventCounter: number;
  ordinalCounter: number;
  resolutionCounter: number;
  narrativeCauseCounter: number;
}

/**
 * Event Bus for combat event management
 * Uses priority queue for event processing
 * Singleton pattern for global access
 */
export class EventBus {
  private static _instance: EventBus;
  private static readonly DEFAULT_MAX_HISTORY_SIZE = 1000;
  private static readonly UNSCOPED_SEQUENCE_ID = 'sequence_v3_unscoped';
  private static readonly MAX_CAUSAL_DEPTH = 128;

  public static get instance(): EventBus {
    if (!this._instance) {
      this._instance = new EventBus();
    }
    return this._instance;
  }

  private _subscribers = new Map<string, EventSubscriber[]>();
  private _eventHistory: CombatEvent[] = [];
  private _sequenceStack: ResolvedCombatSequenceScopeV3[] = [];
  private _causalContextStack: Array<{
    trace?: CombatTraceV3;
    origin?: CombatOriginV3;
  }> = [];
  private _sequenceCounter = 0;
  private _eventCounter = 0;
  private _ordinalCounter = 0;
  private _resolutionCounter = 0;
  private _narrativeCauseCounter = 0;
  private _combatFactSink?: CombatFactSink;
  private readonly _maxHistorySize = EventBus.DEFAULT_MAX_HISTORY_SIZE;

  constructor(public readonly clock: BattleClock = new SystemBattleClock()) {}

  /**
   * Subscribe to an event type with handler and optional priority
   * Higher priority handlers execute first
   * Same priority handlers execute in insertion order
   * Returns the wrapped handler for use with unsubscribe
   */
  public subscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: EventPriority = 0,
  ): EventHandler<T> {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }

    const subscribers = this._subscribers.get(eventType)!;
    // Wrap handler to accept CombatEvent base type
    const wrappedHandler: (event: CombatEvent) => void =
      handler as EventHandler<CombatEvent>;

    subscribers.push({ wrappedHandler, priority });

    subscribers.sort((a, b) => b.priority - a.priority);

    // Return the original handler for convenience
    return handler;
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

    // Filter by comparing wrapped handlers using reference equality
    const wrappedHandler = handler as EventHandler<CombatEvent>;
    const filtered = subscribers.filter(
      (s) => s.wrappedHandler !== wrappedHandler,
    );

    if (filtered.length === 0) {
      // Remove the event type entirely if no subscribers left
      this._subscribers.delete(eventType);
    } else {
      this._subscribers.set(eventType, filtered);
    }
  }

  /**
   * Publish an event to all subscribers
   * Automatically sets timestamp if not provided
   */
  public publish<T extends CombatEvent>(event: T): T {
    return this._dispatch(this._prepare(event));
  }

  /**
   * Publish an immutable result event. Unlike gameplay request events, result
   * events cannot be changed by subscribers during synchronous dispatch.
   */
  public publishImmutable<T extends CombatEvent>(event: T): T {
    const prepared = this._prepare(event);
    if (prepared.trace) Object.freeze(prepared.trace);
    Object.freeze(prepared);
    return this._dispatch(prepared);
  }

  private _prepare<T extends CombatEvent>(event: T): T {
    const sequence = this._sequenceStack[this._sequenceStack.length - 1];
    const parentContext =
      this._causalContextStack[this._causalContextStack.length - 1];
    const reservedTrace = event.trace;
    const eventId = reservedTrace?.eventId ?? this.nextEventId();
    const eventWithTimestamp = Object.assign(event, {
      timestamp: event.timestamp ?? this.clock.now(),
      trace: {
        eventId,
        sequenceId:
          reservedTrace?.sequenceId ??
          sequence?.id ??
          EventBus.UNSCOPED_SEQUENCE_ID,
        ordinal: reservedTrace?.ordinal ?? ++this._ordinalCounter,
        parentEventId:
          reservedTrace?.parentEventId ?? parentContext?.trace?.eventId,
        resolutionId:
          reservedTrace?.resolutionId ?? parentContext?.trace?.resolutionId,
        narrativeCauseId:
          reservedTrace?.narrativeCauseId ??
          parentContext?.trace?.narrativeCauseId,
      },
      origin: event.origin ?? parentContext?.origin,
    }) as T;

    return eventWithTimestamp;
  }

  private _dispatch<T extends CombatEvent>(eventWithTimestamp: T): T {
    this._eventHistory.push(eventWithTimestamp);
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory.shift();
    }

    if (eventWithTimestamp.type === 'CombatResultCommittedEventV3') {
      this._combatFactSink?.record(
        eventWithTimestamp as unknown as CombatResultCommittedEventV3,
      );
    }

    const subscribers = this._subscribers.get(eventWithTimestamp.type);
    if (!subscribers) return eventWithTimestamp;
    const dispatchList = [...subscribers];
    if (this._causalContextStack.length >= EventBus.MAX_CAUSAL_DEPTH) {
      throw new BattleResolutionError(
        'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
        `Battle causal depth exceeded ${EventBus.MAX_CAUSAL_DEPTH}`,
      );
    }
    this._causalContextStack.push({
      trace: eventWithTimestamp.trace!,
      origin: eventWithTimestamp.origin,
    });
    try {
      for (const subscriber of dispatchList) {
        subscriber.wrappedHandler(eventWithTimestamp);
      }
    } finally {
      this._causalContextStack.pop();
    }
    return eventWithTimestamp;
  }

  public runInSequence<T>(
    scope: CombatSequenceScopeV3,
    callback: (scope: ResolvedCombatSequenceScopeV3) => T,
  ): T {
    const resolved: ResolvedCombatSequenceScopeV3 = {
      ...scope,
      id: scope.id ?? `sequence_v3_${++this._sequenceCounter}`,
    };
    this._sequenceStack.push(resolved);
    try {
      return callback(resolved);
    } finally {
      this._sequenceStack.pop();
    }
  }

  public runInCausalContext<T>(
    context: { origin?: CombatOriginV3; trace?: CombatTraceV3 },
    callback: () => T,
  ): T {
    if (this._causalContextStack.length >= EventBus.MAX_CAUSAL_DEPTH) {
      throw new BattleResolutionError(
        'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
        `Battle causal depth exceeded ${EventBus.MAX_CAUSAL_DEPTH}`,
      );
    }
    this._causalContextStack.push(context);
    try {
      return callback();
    } finally {
      this._causalContextStack.pop();
    }
  }

  public reserveTrace(options?: {
    resolutionId?: string;
    parentEventId?: string;
    narrativeCauseId?: string;
  }): CombatTraceV3 {
    const sequence = this.getCurrentSequence();
    const parentTrace = this.getCurrentTrace();
    return {
      eventId: this.nextEventId(),
      sequenceId: sequence?.id ?? EventBus.UNSCOPED_SEQUENCE_ID,
      ordinal: ++this._ordinalCounter,
      parentEventId: options?.parentEventId ?? parentTrace?.eventId,
      resolutionId: options?.resolutionId ?? parentTrace?.resolutionId,
      narrativeCauseId:
        options?.narrativeCauseId ?? parentTrace?.narrativeCauseId,
    };
  }

  public nextNarrativeCauseId(): string {
    return `narrative_v3_${++this._narrativeCauseCounter}`;
  }

  public reserveResolutionTrace(parentEventId?: string): CombatTraceV3 & {
    resolutionId: string;
  } {
    const resolutionId = `resolution_v3_${++this._resolutionCounter}`;
    return {
      ...this.reserveTrace({ resolutionId, parentEventId }),
      resolutionId,
    };
  }

  public getCurrentSequence(): ResolvedCombatSequenceScopeV3 | undefined {
    return this._sequenceStack[this._sequenceStack.length - 1];
  }

  public getCurrentOrigin(): CombatOriginV3 | undefined {
    return this._causalContextStack[this._causalContextStack.length - 1]
      ?.origin;
  }

  public getCurrentTrace(): CombatTraceV3 | undefined {
    return this._causalContextStack[this._causalContextStack.length - 1]?.trace;
  }

  public attachCombatFactSink(sink: CombatFactSink): void {
    if (this._combatFactSink && this._combatFactSink !== sink) {
      throw new Error('EventBus already has an active combat fact sink');
    }
    this._combatFactSink = sink;
  }

  public detachCombatFactSink(sink: CombatFactSink): void {
    if (this._combatFactSink === sink) this._combatFactSink = undefined;
  }

  private nextEventId(): string {
    return `event_v3_${++this._eventCounter}`;
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

  public exportCursor(): EventBusCursorV1 {
    if (this._sequenceStack.length || this._causalContextStack.length) {
      throw new Error('EventBus cursor can only be exported at a quiescent boundary');
    }
    return {
      sequenceCounter: this._sequenceCounter,
      eventCounter: this._eventCounter,
      ordinalCounter: this._ordinalCounter,
      resolutionCounter: this._resolutionCounter,
      narrativeCauseCounter: this._narrativeCauseCounter,
    };
  }

  public restoreCursor(cursor: EventBusCursorV1): void {
    if (this._eventHistory.length || this._sequenceStack.length || this._causalContextStack.length) {
      throw new Error('EventBus cursor must be restored into a fresh bus');
    }
    for (const value of Object.values(cursor)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Invalid EventBus cursor');
      }
    }
    this._sequenceCounter = cursor.sequenceCounter;
    this._eventCounter = cursor.eventCounter;
    this._ordinalCounter = cursor.ordinalCounter;
    this._resolutionCounter = cursor.resolutionCounter;
    this._narrativeCauseCounter = cursor.narrativeCauseCounter;
  }

  /**
   * Reset all subscribers and event history.
   *
   * @remarks
   * After calling `reset()`, all registered handlers (including those registered
   * by `Ability` instances via `AbilityFactory.fromAbilityConfig`) are removed.
   * Callers must re-register handlers before publishing events — typically by
   * re-creating Ability objects or calling their registration methods again.
   *
   * This method is intended for use in tests (`beforeEach`/`afterEach`) to
   * ensure test isolation. Avoid calling it in production code.
   */
  public reset(): void {
    this._subscribers.clear();
    this._eventHistory = [];
    this._sequenceStack = [];
    this._causalContextStack = [];
    this._sequenceCounter = 0;
    this._eventCounter = 0;
    this._ordinalCounter = 0;
    this._resolutionCounter = 0;
    this._narrativeCauseCounter = 0;
    this._combatFactSink = undefined;
  }
}
