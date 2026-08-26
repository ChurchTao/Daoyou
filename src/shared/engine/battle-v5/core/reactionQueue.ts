import type { CombatEvent, EventPriority } from './types';

export interface QueuedReaction {
  readonly event: CombatEvent;
  readonly priority: EventPriority;
  readonly ordinal: number;
}

/**
 * Deterministic FIFO/priority queue for secondary combat reactions.
 * Primary resolution events are dispatched synchronously; reactions produced
 * while resolving one are drained only after the current event settles.
 */
export class ReactionQueue {
  private readonly items: QueuedReaction[] = [];
  private ordinal = 0;

  enqueue(event: CombatEvent, priority: EventPriority): void {
    this.items.push({ event, priority, ordinal: ++this.ordinal });
    this.items.sort((a, b) => b.priority - a.priority || a.ordinal - b.ordinal);
  }

  dequeue(): QueuedReaction | undefined {
    return this.items.shift();
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
