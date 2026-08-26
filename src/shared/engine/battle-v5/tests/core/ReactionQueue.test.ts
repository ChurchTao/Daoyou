import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import type { CombatEvent } from '../../core/types';

interface MarkerEvent extends CombatEvent {
  type: 'ReactionMarkerEvent';
  label: string;
}

describe('reaction queue', () => {
  afterEach(() => EventBus.instance.reset());

  it('drains secondary reactions after the current event and by priority', () => {
    const log: string[] = [];
    EventBus.instance.subscribe<CombatEvent>('PrimaryEvent', () => {
      log.push('primary:start');
      EventBus.instance.enqueueReaction<MarkerEvent>({
        type: 'ReactionMarkerEvent',
        timestamp: 0,
        label: 'low',
      }, 10);
      EventBus.instance.enqueueReaction<MarkerEvent>({
        type: 'ReactionMarkerEvent',
        timestamp: 0,
        label: 'high',
      }, 20);
      log.push('primary:end');
    });
    EventBus.instance.subscribe<MarkerEvent>(
      'ReactionMarkerEvent',
      (event) => log.push(`reaction:${event.label}`),
    );

    EventBus.instance.publish({ type: 'PrimaryEvent', timestamp: 0 });

    expect(log).toEqual([
      'primary:start',
      'primary:end',
      'reaction:high',
      'reaction:low',
    ]);
  });

  it('preserves causal parent trace for queued reactions', () => {
    let parentEventId: string | undefined;
    EventBus.instance.subscribe<CombatEvent>('PrimaryEvent', (event) => {
      EventBus.instance.enqueueReaction<MarkerEvent>({
        type: 'ReactionMarkerEvent',
        timestamp: 0,
        label: 'trace',
      });
      parentEventId = event.trace?.eventId;
    });
    let reactionParentEventId: string | undefined;
    EventBus.instance.subscribe<MarkerEvent>(
      'ReactionMarkerEvent',
      (event) => { reactionParentEventId = event.trace?.parentEventId; },
    );

    EventBus.instance.publish({ type: 'PrimaryEvent', timestamp: 0 });

    expect(reactionParentEventId).toBe(parentEventId);
  });
});
