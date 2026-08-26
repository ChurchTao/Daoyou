import { EventBus } from '../../core/EventBus';
import type { DamageSegmentRequestedEvent } from '../../core/events';
import type { CombatResultCommittedEventV3 } from '../../v3/events';
import { CombatV3EventType } from '../../v3/events';
import { combatCarrierFromAbilityV3 } from '../../v3/origin';
import type { CombatFactDraftV3, CombatOriginV3 } from '../../v3/types';
import type { Unit } from '../../units/Unit';

let sequenceCounter = 0;

type CommittedResultEventV3<T extends CombatFactDraftV3['type']> =
  CombatResultCommittedEventV3 & {
    result: Extract<CombatFactDraftV3, { type: T }>;
  };

export function collectCommittedResultsV3<T extends CombatFactDraftV3['type']>(
  type: T,
): CommittedResultEventV3<T>[] {
  const events: CommittedResultEventV3<T>[] = [];
  EventBus.instance.subscribe<CombatResultCommittedEventV3>(
    CombatV3EventType.RESULT_COMMITTED,
    (event) => {
      if (event.result.type === type) {
        events.push(event as CommittedResultEventV3<T>);
      }
    },
  );
  return events;
}

export function runTestActionV3<T>(actor: Unit, callback: () => T): T {
  return EventBus.instance.runInSequence(
    {
      id: `test_action_sequence_${++sequenceCounter}`,
      phase: 'action',
      turn: 1,
      actor: { id: actor.id, name: actor.name },
    },
    () =>
      EventBus.instance.runInCausalContext(
        { trace: EventBus.instance.reserveTrace() },
        callback,
      ),
  );
}

export function publishTestDamageRequest(event: DamageSegmentRequestedEvent): void {
  const origin: CombatOriginV3 = event.ability
    ? {
        kind: 'owned',
        owner: { id: event.caster!.id, name: event.caster!.name },
        carrier: combatCarrierFromAbilityV3(event.ability),
      }
    : {
        kind: 'owned',
        owner: { id: event.caster!.id, name: event.caster!.name },
        carrier: {
          kind: 'mechanic',
          id: 'test_damage',
          name: '测试伤害',
        },
      };
  const publish = () =>
    EventBus.instance.publish(Object.assign(event, { origin }));
  if (EventBus.instance.getCurrentSequence()) {
    publish();
    return;
  }
  EventBus.instance.runInSequence(
    {
      id: `test_damage_sequence_${++sequenceCounter}`,
      phase: 'action',
      turn: 1,
      actor: event.caster
        ? { id: event.caster.id, name: event.caster.name }
        : undefined,
    },
    publish,
  );
}
