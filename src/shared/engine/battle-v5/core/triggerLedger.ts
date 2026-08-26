import type { CombatEvent } from './types';
import { getBattleRuntimeState } from './runtimeState';
import type { Unit } from '../units/Unit';

export type TriggerGranularity =
  | 'segment'
  | 'hit'
  | 'cast'
  | 'action'
  | 'round'
  | 'battle'
  | 'buff_lifetime';

export interface TriggerPolicy {
  readonly maxTriggers: number;
  readonly granularity: TriggerGranularity;
  readonly group?: string;
}

interface LedgerEntry {
  token: string;
  count: number;
}

const lifetimeLedger = new WeakMap<object, Map<string, number>>();

/** Central, atomic trigger claim store for all data-driven listeners. */
export class TriggerLedger {
  claim(
    owner: Unit,
    event: CombatEvent,
    listenerId: string,
    policy: TriggerPolicy | undefined,
    source?: object,
  ): boolean {
    if (!policy) return true;
    const maxTriggers = Math.max(0, Math.trunc(policy.maxTriggers));
    if (maxTriggers <= 0) return false;

    if (policy.granularity === 'buff_lifetime') {
      const lifetimeOwner = source ?? owner;
      const entries = lifetimeLedger.get(lifetimeOwner) ?? new Map();
      const key = policy.group ?? listenerId;
      const count = entries.get(key) ?? 0;
      if (count >= maxTriggers) return false;
      entries.set(key, count + 1);
      lifetimeLedger.set(lifetimeOwner, entries);
      return true;
    }

    const token = this.resolveToken(owner, event, listenerId, policy.granularity);
    const state = getBattleRuntimeState(owner);
    const key = `${policy.group ?? listenerId}:${policy.granularity}`;
    const current = state.triggerLedger.get(key) as LedgerEntry | undefined;
    const count = current?.token === token ? current.count : 0;
    if (count >= maxTriggers) return false;
    state.triggerLedger.set(key, { token, count: count + 1 });
    return true;
  }

  private resolveToken(
    owner: Unit,
    event: CombatEvent,
    listenerId: string,
    granularity: Exclude<TriggerGranularity, 'buff_lifetime'>,
  ): string {
    const resolution = event.resolution;
    if (!resolution && granularity !== 'round' && granularity !== 'battle') {
      throw new Error(
        `Trigger ${listenerId} requires a combat resolution for ${granularity} granularity`,
      );
    }
    switch (granularity) {
      case 'segment':
        if (resolution!.segmentIndex === undefined) {
          throw new Error(
            `Trigger ${listenerId} requires segmentIndex for segment granularity`,
          );
        }
        return `${resolution!.hitId}:${resolution!.segmentIndex}`;
      case 'hit':
        return resolution!.hitId;
      case 'cast':
        return resolution!.castId;
      case 'action':
        return resolution!.actionId;
      case 'round':
        return String(getBattleRuntimeState(owner).round);
      case 'battle':
        return 'battle';
    }
  }
}

export const triggerLedger = new TriggerLedger();
