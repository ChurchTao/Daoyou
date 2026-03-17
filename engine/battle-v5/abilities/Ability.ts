import { AbilityId, AbilityType } from '../core/types';

/**
 * Base Ability interface - stub for Task 4
 * Full implementation will come in later tasks
 */
export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;
  private _active: boolean = false;

  constructor(id: AbilityId, name: string, type: AbilityType) {
    this.id = id;
    this.name = name;
    this.type = type;
  }

  setActive(active: boolean): void {
    this._active = active;
  }

  isActive(): boolean {
    return this._active;
  }
}
