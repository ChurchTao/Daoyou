import type { EventBus } from '../core/EventBus';
import { BattleResolutionError } from '../core/BattleResolutionError';
import { CombatFactProjectorV3 } from './CombatFactProjectorV3';
import type { CombatResultCommittedEventV3 } from './events';
import type {
  CombatSequenceScopeV3,
  CombatSequenceV3,
  ResolvedCombatSequenceScopeV3,
} from './types';

/**
 * Authoritative collector for immutable combat facts produced by one resolver.
 * A fact can only be accepted while its sequence is registered in this sink.
 */
export class CombatFactSinkV3 {
  private static readonly MAX_FRAMES = 256;
  private static readonly MAX_FACTS = 4_096;
  private readonly sequences = new Map<string, CombatSequenceV3>();
  private readonly sequenceOrder: string[] = [];
  private readonly projector = new CombatFactProjectorV3();
  private attached = true;
  private factCount = 0;

  constructor(private readonly eventBus: EventBus) {
    eventBus.attachCombatFactSink(this);
  }

  record(event: CombatResultCommittedEventV3): void {
    if (this.factCount >= CombatFactSinkV3.MAX_FACTS) {
      throw new BattleResolutionError(
        'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
        `Battle fact count exceeded ${CombatFactSinkV3.MAX_FACTS}`,
      );
    }
    const sequenceId = event.trace?.sequenceId;
    const sequence = sequenceId ? this.sequences.get(sequenceId) : undefined;
    if (!sequence) {
      throw new Error(
        `Committed combat result references unknown sequence: ${sequenceId}`,
      );
    }
    sequence.facts.push(this.projector.project(event));
    this.factCount += 1;
  }

  runInFrame<T>(
    scope: CombatSequenceScopeV3,
    callback: (scope: ResolvedCombatSequenceScopeV3) => T,
  ): T {
    return this.eventBus.runInSequence(scope, (resolved) => {
      if (this.sequenceOrder.length >= CombatFactSinkV3.MAX_FRAMES) {
        throw new BattleResolutionError(
          'BATTLE_RESOLUTION_LIMIT_EXCEEDED',
          `Battle frame count exceeded ${CombatFactSinkV3.MAX_FRAMES}`,
        );
      }
      if (this.sequences.has(resolved.id)) {
        throw new Error(`Duplicate CombatSequenceV3 id: ${resolved.id}`);
      }
      this.sequences.set(resolved.id, { ...resolved, facts: [] });
      this.sequenceOrder.push(resolved.id);
      try {
        return callback(resolved);
      } finally {
        const sequence = this.sequences.get(resolved.id)!;
        sequence.actor = resolved.actor;
        sequence.ability = resolved.ability;
      }
    });
  }

  getSequences(): CombatSequenceV3[] {
    return this.sequenceOrder.map((id) => {
      const sequence = this.sequences.get(id)!;
      return {
        ...sequence,
        facts: [...sequence.facts].sort(
          (left, right) => left.trace.ordinal - right.trace.ordinal,
        ),
      };
    });
  }

  destroy(): void {
    if (!this.attached) return;
    this.attached = false;
    this.eventBus.detachCombatFactSink(this);
  }
}
