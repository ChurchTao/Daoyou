import type { CombatResourceDefinition } from '@shared/engine/sect/types';

export interface CombatResourceSnapshot {
  id: string;
  name: string;
  current: number;
  max: number;
}

interface CombatResourceRuntime extends CombatResourceDefinition {
  current: number;
}

export class CombatResourceContainer {
  private readonly resources = new Map<string, CombatResourceRuntime>();
  private dealtDirectDamageThisAction = false;

  define(definition: CombatResourceDefinition): void {
    const max = Math.max(0, Math.floor(definition.max));
    const initial = Math.max(0, Math.min(max, Math.floor(definition.initial)));
    this.resources.set(definition.id, { ...definition, max, initial, current: initial });
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

  modify(id: string, delta: number): number {
    const resource = this.resources.get(id);
    if (!resource) return 0;
    resource.current = Math.max(
      0,
      Math.min(resource.max, resource.current + Math.trunc(delta)),
    );
    return resource.current;
  }

  set(id: string, value: number): number {
    const resource = this.resources.get(id);
    if (!resource) return 0;
    resource.current = Math.max(0, Math.min(resource.max, Math.trunc(value)));
    return resource.current;
  }

  consume(id: string, amount: number | 'all'): number {
    const resource = this.resources.get(id);
    if (!resource) return 0;
    const consumed = amount === 'all'
      ? resource.current
      : Math.min(resource.current, Math.max(0, Math.trunc(amount)));
    resource.current -= consumed;
    return consumed;
  }

  beginAction(): void {
    this.dealtDirectDamageThisAction = false;
  }

  markDirectDamageDealt(): void {
    this.dealtDirectDamageThisAction = true;
  }

  finishAction(controlledSkip = false, hasShield = false): void {
    if (this.dealtDirectDamageThisAction) return;
    for (const resource of this.resources.values()) {
      if (hasShield && resource.pauseDecayWhileShielded) continue;
      const decay = controlledSkip
        ? resource.decayOnControlledSkip ?? resource.decayOnNoDirectDamage ?? 0
        : resource.decayOnNoDirectDamage ?? 0;
      if (decay > 0) this.modify(resource.id, -decay);
    }
  }

  snapshots(): CombatResourceSnapshot[] {
    return Array.from(this.resources.values()).map(({ id, name, current, max }) => ({
      id,
      name,
      current,
      max,
    }));
  }

  clone(): CombatResourceContainer {
    const clone = new CombatResourceContainer();
    for (const resource of this.resources.values()) {
      clone.define(resource);
      clone.set(resource.id, resource.current);
    }
    return clone;
  }
}
