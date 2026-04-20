import { Unit } from './Unit';
import { BuffId } from '../core/types';
import { Buff, StackRule } from '../buffs/Buff';
import {
  BuffAddEvent,
  BuffAppliedEvent,
  BuffRemovedEvent,
} from '../core/events';
import { EventBus } from '../core/EventBus';

/**
 * BuffContainer - Buff 容器
 *
 * GAS+EDA 架构设计：
 * - 管理 Unit 身上的所有 Buff
 * - 负责调用 Buff 的生命周期方法（setOwner → onActivate → onDeactivate）
 * - 处理标签免疫检查和堆叠规则
 */
export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  /**
   * 添加 Buff
   * @param buff 要添加的 Buff
   * @param source Buff 来源（通常是施法者），用于 DOT 伤害归属等
   */
  addBuff(buff: Buff, source?: Unit): void {
    // 1. 发布拦截事件
    const event: BuffAddEvent = {
      type: 'BuffAddEvent',
      timestamp: Date.now(),
      target: this._owner,
      buff,
      isCancelled: false,
    };
    EventBus.instance.publish(event);
    if (event.isCancelled) return;

    // 2. 堆叠规则处理
    const existing = this._buffs.get(buff.id);
    if (existing) {
      this._applyStackRule(existing, buff, source);
      return;
    }

    // 3. 添加新 BUFF（GAS 模式）
    this._buffs.set(buff.id, buff);

    // 3.1 设置 owner 引用（关键：必须在 onActivate 之前）
    buff.setOwner(this._owner);

    // 3.2 设置 source 引用（如果提供）
    if (source) {
      buff.setSource(source);
    }

    // 3.3 调用激活方法（子类在此订阅事件、添加标签等）
    buff.onActivate();

    // 3.4 更新派生属性
    this._owner.updateDerivedStats();

    // 4. 发布应用成功事件
    const appliedEvent: BuffAppliedEvent = {
      type: 'BuffAppliedEvent',
      timestamp: Date.now(),
      target: this._owner,
      buff,
      source,
    };
    EventBus.instance.publish(appliedEvent);
  }

  /**
   * 移除 BUFF（手动移除，如驱散）
   */
  removeBuff(buffId: BuffId): void {
    this._removeBuffWithReason(buffId, 'manual');
  }

  /**
   * 移除 BUFF（过期）
   */
  removeBuffExpired(buffId: BuffId): void {
    this._removeBuffWithReason(buffId, 'expired');
  }

  private _removeBuffWithReason(buffId: BuffId, reason: 'manual' | 'expired' | 'dispel' | 'replace'): void {
    const buff = this._buffs.get(buffId);
    if (!buff) return;

    // GAS 模式：调用 onDeactivate（取消订阅、移除标签等）
    buff.onDeactivate();

    this._buffs.delete(buffId);
    this._owner.updateDerivedStats();

    // 发布移除事件
    const removedEvent: BuffRemovedEvent = {
      type: 'BuffRemovedEvent',
      timestamp: Date.now(),
      target: this._owner,
      buff,
      reason,
    };
    EventBus.instance.publish(removedEvent);
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
        buff.onDeactivate();
      }
    }
    this._buffs.clear();
    this._owner.updateDerivedStats();
  }

  private _applyStackRule(existing: Buff, newBuff: Buff, source?: Unit): void {
    switch (newBuff.stackRule) {
      case StackRule.STACK_LAYER:
        existing.addLayer(1);
        if (source) {
          existing.setSource(source);
        }
        break;

      case StackRule.REFRESH_DURATION:
        existing.refreshToDuration(newBuff.getMaxDuration());
        if (source) {
          existing.setSource(source);
        }
        break;

      case StackRule.OVERRIDE:
        existing.onDeactivate();
        this._buffs.set(existing.id, newBuff);
        newBuff.setOwner(this._owner);
        if (source) {
          newBuff.setSource(source);
        }
        newBuff.onActivate();
        this._owner.updateDerivedStats();
        break;

      case StackRule.IGNORE:
        break;
    }
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    for (const buff of this._buffs.values()) {
      const clonedBuff = buff.clone();
      clone._buffs.set(clonedBuff.id, clonedBuff);
      // 使用新的生命周期方法
      clonedBuff.setOwner(owner);
      clonedBuff.onActivate();
    }
    return clone;
  }
}
