import { BuffId, BuffType } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * Base Buff interface - stub for Task 4
 * Full implementation will come in later tasks
 */
export class Buff {
  readonly id: BuffId;
  readonly name: string;
  readonly type: BuffType;
  private _duration: number;

  constructor(id: BuffId, name: string, type: BuffType, duration: number) {
    this.id = id;
    this.name = name;
    this.type = type;
    this._duration = duration;
  }

  refreshDuration(): void {
    // Stub - will be implemented in later tasks
  }

  onApply(unit: Unit): void {
    // Stub - will be implemented in later tasks
  }

  onRemove(unit: Unit): void {
    // Stub - will be implemented in later tasks
  }

  getDuration(): number {
    return this._duration;
  }
}
