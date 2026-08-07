import type { EventBus } from '../core/EventBus';
import type { Unit } from '../units/Unit';
import { CombatV3EventType, type CombatResultCommittedEventV3 } from './events';
import { freezeCombatOriginV3 } from './origin';
import type {
  CombatFactDraftV3,
  CombatNarrativeRelationV3,
  CombatOriginV3,
  CombatTraceV3,
} from './types';

export interface CombatResultScopeV3 {
  origin: CombatOriginV3;
  parentTrace: CombatTraceV3;
  reservedTrace?: CombatTraceV3;
  narrativeRole?: CombatNarrativeRelationV3['role'];
}

export class CombatResultEmitterV3 {
  constructor(private readonly eventBus?: EventBus) {}

  commit(
    target: Unit,
    result: CombatFactDraftV3,
    scope: CombatResultScopeV3,
  ): CombatResultCommittedEventV3 {
    const origin = scope?.origin;
    const parentTrace = scope?.parentTrace;
    if (!origin) throw new Error(`Combat result ${result.type} has no origin`);
    if (!parentTrace) {
      throw new Error(`Combat result ${result.type} has no parent trace`);
    }
    if (scope.reservedTrace?.eventId === parentTrace.eventId) {
      throw new Error(`Combat result ${result.type} cannot be its own parent`);
    }

    const immutableOrigin = freezeCombatOriginV3(origin);
    const immutableResult = freezeResult(result);
    const narrative = parentTrace.narrativeCauseId
      ? Object.freeze({
          causeId: parentTrace.narrativeCauseId,
          role: scope.narrativeRole ?? ('result' as const),
        })
      : undefined;
    const eventBus = this.eventBus ?? target.runtime.events;
    const committed = eventBus.runInCausalContext(
      { origin: immutableOrigin, trace: parentTrace },
      () =>
        eventBus.publishImmutable<CombatResultCommittedEventV3>({
          type: CombatV3EventType.RESULT_COMMITTED,
          timestamp: target.runtime.clock.now(),
          target,
          result: immutableResult,
          narrative,
          trace: scope.reservedTrace,
          origin: immutableOrigin,
        }),
    );
    if (!committed.trace) {
      throw new Error(`Combat result ${result.type} has no committed trace`);
    }
    return committed;
  }
}

function freezeResult(result: CombatFactDraftV3): CombatFactDraftV3 {
  if (result.type === 'unit_died' && result.killer) {
    return Object.freeze({
      ...result,
      killer: Object.freeze({ ...result.killer }),
    });
  }
  if (result.type === 'action_state' && result.ability) {
    return Object.freeze({
      ...result,
      ability: Object.freeze({ ...result.ability }),
    });
  }
  if (result.type === 'mechanic') {
    const payload =
      result.payload.kind === 'ability_transform'
        ? Object.freeze({
            ...result.payload,
            modifiers: Object.freeze(
              result.payload.modifiers.map((modifier) =>
                Object.freeze({ ...modifier }),
              ),
            ),
          })
        : Object.freeze({ ...result.payload });
    return Object.freeze({ ...result, payload }) as CombatFactDraftV3;
  }
  return Object.freeze({ ...result }) as CombatFactDraftV3;
}
