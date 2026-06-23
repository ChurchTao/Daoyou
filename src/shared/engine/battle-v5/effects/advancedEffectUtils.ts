import { Buff } from '../buffs/Buff';
import { BuffMatchParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { MechanicLogEvent } from '../core/events';
import { EffectContext } from './Effect';

export function matchesBuff(buff: Buff, match?: BuffMatchParams): boolean {
  if (!match) return true;
  if (match.id && buff.id !== match.id) return false;
  if (match.tags && match.tags.length > 0) {
    return match.tags.some((tag) => buff.tags.hasTag(tag));
  }
  return true;
}

export function findMatchingBuffs(
  target: EffectContext['target'],
  match?: BuffMatchParams,
): Buff[] {
  return target.buffs.getAllBuffs().filter((buff) => matchesBuff(buff, match));
}

export function publishMechanicLog(
  event: Omit<MechanicLogEvent, 'type' | 'timestamp'>,
): void {
  EventBus.instance.publish<MechanicLogEvent>({
    type: 'MechanicLogEvent',
    timestamp: Date.now(),
    ...event,
  });
}
