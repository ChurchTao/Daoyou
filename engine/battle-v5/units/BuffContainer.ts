import { Unit } from './Unit';
import { BuffId } from '../core/types';
import { Buff } from '../buffs/Buff';

export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  addBuff(buff: Buff): void {
    const existing = this._buffs.get(buff.id);
    if (existing) {
      existing.refreshDuration();
      return;
    }

    this._buffs.set(buff.id, buff);
    buff.onApply(this._owner);
    this._owner.updateDerivedStats();
  }

  removeBuff(buffId: BuffId): void {
    const buff = this._buffs.get(buffId);
    if (!buff) return;

    buff.onRemove(this._owner);
    this._buffs.delete(buffId);
    this._owner.updateDerivedStats();
  }

  getAllBuffs(): Buff[] {
    return Array.from(this._buffs.values());
  }

  getAllBuffIds(): BuffId[] {
    return Array.from(this._buffs.keys());
  }

  clear(): void {
    for (const id of this._buffs.keys()) {
      this.removeBuff(id);
    }
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    // Deep copy will be implemented when Buff system is ready
    return clone;
  }
}
