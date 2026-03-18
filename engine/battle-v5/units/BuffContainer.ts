import { Unit } from './Unit';
import { BuffId } from '../core/types';
import { Buff, StackRule } from '../buffs/Buff';
import { BuffAddEvent } from '../core/events';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel } from '../core/events';
import { GameplayTags } from '../core/GameplayTags';

export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  addBuff(buff: Buff): void {
    // 1. 发布拦截事件
    const event: BuffAddEvent = {
      type: 'BuffAddEvent',
      priority: EventPriorityLevel.BUFF_INTERCEPT,
      timestamp: Date.now(),
      target: this._owner,
      buff,
      isCancelled: false,
    };
    EventBus.instance.publish(event);
    if (event.isCancelled) return;

    // 2. 标签免疫检查
    if (this._checkImmune(buff)) return;

    // 3. 堆叠规则处理
    const existing = this._buffs.get(buff.id);
    if (existing) {
      this._applyStackRule(existing, buff);
      return;
    }

    // 4. 添加新 BUFF
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

  private _checkImmune(buff: Buff): boolean {
    const isDebuff = buff.tags.hasTag(GameplayTags.BUFF.TYPE_DEBUFF);
    if (!isDebuff) return false;

    return this._owner.tags.hasAnyTag([
      GameplayTags.STATUS.IMMUNE_DEBUFF,
      GameplayTags.STATUS.IMMUNE,
    ]);
  }

  private _applyStackRule(existing: Buff, newBuff: Buff): void {
    switch (newBuff.stackRule) {
      case StackRule.STACK_LAYER:
        // Check if buff has addLayer method (for layered buffs)
        const layeredBuff = existing as unknown as { addLayer?: (layers: number) => void };
        if (layeredBuff.addLayer && typeof layeredBuff.addLayer === 'function') {
          layeredBuff.addLayer(1);
        }
        break;

      case StackRule.REFRESH_DURATION:
        // Refresh to the new buff's duration, not the existing buff's max duration
        existing.refreshToDuration(newBuff.getMaxDuration());
        break;

      case StackRule.OVERRIDE:
        this.removeBuff(existing.id);
        this.addBuff(newBuff);
        break;

      case StackRule.IGNORE:
        // Do nothing
        break;
    }
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    for (const buff of this._buffs.values()) {
      const clonedBuff = buff.clone();
      clone._buffs.set(clonedBuff.id, clonedBuff);
      clonedBuff.onApply(owner);
    }
    return clone;
  }
}
