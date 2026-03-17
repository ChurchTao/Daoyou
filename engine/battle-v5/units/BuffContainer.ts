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
    const buffIds = Array.from(this._buffs.keys());
    for (const id of buffIds) {
      const buff = this._buffs.get(id);
      if (buff) {
        buff.onRemove(this._owner);
      }
    }
    this._buffs.clear();
    this._owner.updateDerivedStats();
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    // TODO: 实现深拷贝：遍历 this._buffs，复制每个 Buff 实例并添加到 clone
    // 当前返回空容器，适用于 Buff 系统未完成时的占位实现
    return clone;
  }
}
