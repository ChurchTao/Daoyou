import type { CombatResourceDefinition } from '../core/configs';
import type { Ability } from '../abilities/Ability';
import { EventBus } from '../core/EventBus';
import type { CombatResourceChangeEvent } from '../core/events';
import { readRuntimeCounter } from '../core/runtimeState';
import type { Unit } from './Unit';

interface CombatResourceChangeSource {
  caster?: Unit;
  ability?: Ability;
  operation?: CombatResourceChangeEvent['operation'];
  reason?: CombatResourceChangeEvent['reason'];
}

export interface CombatResourceSnapshot {
  id: string;
  name: string;
  icon?: string;
  current: number;
  max: number;
}

interface CombatResourceRuntime extends CombatResourceDefinition {
  current: number;
}

export class CombatResourceContainer {
  private readonly resources = new Map<string, CombatResourceRuntime>();
  private readonly noDirectDamageActionCounts = new Map<string, number>();
  private dealtDirectDamageThisAction = false;
  private owner?: Unit;

  bindOwner(owner: Unit): void {
    this.owner = owner;
  }

  define(definition: CombatResourceDefinition): void {
    const max = Math.max(0, Math.floor(definition.max));
    const initial = Math.max(0, Math.min(max, Math.floor(definition.initial)));
    this.resources.set(definition.id, { ...definition, max, initial, current: initial });
    this.noDirectDamageActionCounts.set(definition.id, 0);
  }

  has(id: string): boolean {
    return this.resources.has(id);
  }

  getCurrent(id: string): number {
    return this.resources.get(id)?.current ?? 0;
  }

  getMax(id: string): number {
    return this.resources.get(id)?.max ?? 0;
  }

  modify(id: string, delta: number, source?: CombatResourceChangeSource): number {
    const resource = this.resources.get(id);
    if (!resource) return 0;
    const before = resource.current;
    const requested = Math.trunc(delta);
    resource.current = Math.max(
      0,
      Math.min(resource.max, resource.current + requested),
    );
    this.publishChange(resource, before, requested, source);
    return resource.current;
  }

  set(id: string, value: number, source?: CombatResourceChangeSource): number {
    const resource = this.resources.get(id);
    if (!resource) return 0;
    const before = resource.current;
    resource.current = Math.max(0, Math.min(resource.max, Math.trunc(value)));
    this.publishChange(resource, before, Math.trunc(value) - before, {
      ...source,
      operation: source?.operation ?? 'set',
    });
    return resource.current;
  }

  consume(id: string, amount: number | 'all', source?: CombatResourceChangeSource): number {
    const resource = this.resources.get(id);
    if (!resource) return 0;
    const before = resource.current;
    const consumed = amount === 'all'
      ? resource.current
      : Math.min(resource.current, Math.max(0, Math.trunc(amount)));
    resource.current -= consumed;
    const requested = -(amount === 'all' ? before : Math.max(0, Math.trunc(amount)));
    this.publishChange(resource, before, requested, {
      ...source,
      operation: source?.operation ?? (amount === 'all' ? 'consume_all' : 'subtract'),
    });
    return consumed;
  }

  beginAction(): void {
    this.dealtDirectDamageThisAction = false;
  }

  markDirectDamageDealt(): void {
    this.dealtDirectDamageThisAction = true;
    for (const id of this.resources.keys()) {
      this.noDirectDamageActionCounts.set(id, 0);
    }
  }

  finishAction(controlledSkip = false, hasShield = false): void {
    if (this.dealtDirectDamageThisAction) return;
    for (const resource of this.resources.values()) {
      if (hasShield && resource.pauseDecayWhileShielded) continue;
      if (
        this.owner &&
        resource.pauseDecayWhenCounterAtLeast &&
        readRuntimeCounter(this.owner, resource.pauseDecayWhenCounterAtLeast.key) >=
          resource.pauseDecayWhenCounterAtLeast.value
      ) continue;
      const decay = controlledSkip
        ? resource.decayOnControlledSkip ?? resource.decayOnNoDirectDamage ?? 0
        : resource.decayOnNoDirectDamage ?? 0;
      if (decay <= 0) continue;

      if (controlledSkip) {
        this.noDirectDamageActionCounts.set(resource.id, 0);
        this.modify(resource.id, -decay, { operation: 'decay' });
        continue;
      }

      const threshold = Math.max(
        1,
        Math.floor(resource.noDirectDamageActionsPerDecay ?? 1),
      );
      const count = (this.noDirectDamageActionCounts.get(resource.id) ?? 0) + 1;
      if (count < threshold) {
        this.noDirectDamageActionCounts.set(resource.id, count);
        continue;
      }
      this.noDirectDamageActionCounts.set(resource.id, 0);
      this.modify(resource.id, -decay, { operation: 'decay' });
    }
  }

  private publishChange(
    resource: CombatResourceRuntime,
    before: number,
    requested: number,
    source?: CombatResourceChangeSource,
  ): void {
    if (!this.owner || requested === 0) return;
    const applied = resource.current - before;
    EventBus.instance.publish<CombatResourceChangeEvent>({
      type: 'CombatResourceChangeEvent',
      timestamp: Date.now(),
      target: this.owner,
      caster: source?.caster,
      ability: source?.ability,
      resourceId: resource.id,
      resourceName: resource.name,
      resourceMax: resource.max,
      operation: source?.operation ?? (requested > 0 ? 'add' : 'subtract'),
      reason:
        source?.reason ??
        (source?.operation === 'decay'
          ? 'decay'
          : requested > 0
            ? 'gain'
            : 'spend'),
      requested,
      applied,
      overflow: requested > 0 ? Math.max(0, requested - applied) : 0,
      before,
      after: resource.current,
    });
  }

  snapshots(): CombatResourceSnapshot[] {
    return Array.from(this.resources.values()).map(({ id, name, icon, current, max }) => ({
      id,
      name,
      icon,
      current,
      max,
    }));
  }

  clone(): CombatResourceContainer {
    const clone = new CombatResourceContainer();
    for (const resource of this.resources.values()) {
      clone.define(resource);
      clone.set(resource.id, resource.current);
      clone.noDirectDamageActionCounts.set(
        resource.id,
        this.noDirectDamageActionCounts.get(resource.id) ?? 0,
      );
    }
    return clone;
  }
}
