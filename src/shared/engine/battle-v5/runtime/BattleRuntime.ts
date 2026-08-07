import {
  battleRandom,
  SeededBattleRandomSource,
  type BattleRandomSource,
} from '../core/BattleRandom';
import { EventBus } from '../core/EventBus';
import {
  LogicalBattleClock,
  type BattleClock,
} from './BattleClock';
import { BattleRuntimeStateStore } from './BattleRuntimeStateStore';
import type { BattleRandomStateV1 } from '../core/BattleRandom';
import type { EventBusCursorV1 } from '../core/EventBus';

export interface BattleRuntimeCursorV1 {
  random: BattleRandomStateV1;
  clock: number;
  events: EventBusCursorV1;
}

export interface BattleRuntimeOptions {
  events?: EventBus;
  random?: BattleRandomSource;
  clock?: BattleClock;
  states?: BattleRuntimeStateStore;
}

export class BattleRuntime {
  readonly events: EventBus;
  readonly random: BattleRandomSource;
  readonly clock: BattleClock;
  readonly states: BattleRuntimeStateStore;

  constructor(options: BattleRuntimeOptions = {}) {
    this.clock = options.clock ?? new LogicalBattleClock();
    this.random = options.random ?? new SeededBattleRandomSource(0);
    this.events = options.events ?? new EventBus(this.clock);
    this.states = options.states ?? new BattleRuntimeStateStore();
  }

  dispose(): void {
    this.events.reset();
    this.states.clear();
  }

  exportCursor(): BattleRuntimeCursorV1 {
    const random = this.random as BattleRandomSource & {
      exportState?: () => BattleRandomStateV1;
    };
    const clock = this.clock as BattleClock & { exportState?: () => number };
    if (
      typeof random.exportState !== 'function' ||
      typeof clock.exportState !== 'function'
    ) {
      throw new Error('Battle runtime is not checkpoint-capable');
    }
    return {
      random: random.exportState(),
      clock: clock.exportState(),
      events: this.events.exportCursor(),
    };
  }

  restoreCursor(cursor: BattleRuntimeCursorV1): void {
    const random = this.random as BattleRandomSource & {
      restoreState?: (state: BattleRandomStateV1) => void;
    };
    const clock = this.clock as BattleClock & {
      restoreState?: (state: number) => void;
    };
    if (
      typeof random.restoreState !== 'function' ||
      typeof clock.restoreState !== 'function'
    ) {
      throw new Error('Battle runtime is not checkpoint-capable');
    }
    random.restoreState(cursor.random);
    clock.restoreState(cursor.clock);
    this.events.restoreCursor(cursor.events);
  }

  /** Compatibility runtime for direct Unit construction in legacy callers. */
  static readonly legacy = new BattleRuntime({
    events: EventBus.instance,
    random: { next: battleRandom },
    clock: EventBus.instance.clock,
  });
}
