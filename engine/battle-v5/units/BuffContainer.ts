import { Unit } from './Unit';
import { BuffId } from '../core/types';
import { Buff, StackRule } from '../buffs/Buff';
import {
  BuffAddEvent,
  BuffAppliedEvent,
  BuffRemovedEvent,
  BuffImmuneEvent,
} from '../core/events';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel } from '../core/events';
import { GameplayTags } from '../core/GameplayTags';

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

    // 4. 添加新 BUFF（GAS 模式）
    this._buffs.set(buff.id, buff);

    // 4.1 设置 owner 引用（关键：必须在 onActivate 之前）
    buff.setOwner(this._owner);

    // 4.2 调用激活方法（子类在此订阅事件、添加标签等）
    buff.onActivate();

    // 4.3 更新派生属性
    this._owner.updateDerivedStats();

    // 5. 发布应用成功事件
    const appliedEvent: BuffAppliedEvent = {
      type: 'BuffAppliedEvent',
      priority: EventPriorityLevel.TAG_CHANGE,
      timestamp: Date.now(),
      target: this._owner,
      buff,
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
      priority: EventPriorityLevel.TAG_CHANGE,
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

  private _checkImmune(buff: Buff): boolean {
    const isDebuff = buff.tags.hasTag(GameplayTags.BUFF.TYPE_DEBUFF);
    if (!isDebuff) return false;

    // 检查免疫标签
    const immuneTags = [
      GameplayTags.STATUS.IMMUNE_DEBUFF,
      GameplayTags.STATUS.IMMUNE,
    ];

    for (const immuneTag of immuneTags) {
      if (this._owner.tags.hasTag(immuneTag)) {
        // 发布免疫拦截事件
        const immuneEvent: BuffImmuneEvent = {
          type: 'BuffImmuneEvent',
          priority: EventPriorityLevel.TAG_CHANGE,
          timestamp: Date.now(),
          target: this._owner,
          buff,
          immuneTag,
        };
        EventBus.instance.publish(immuneEvent);
        return true;
      }
    }

    return false;
  }

  private _applyStackRule(existing: Buff, newBuff: Buff): void {
    switch (newBuff.stackRule) {
      case StackRule.STACK_LAYER:
        // 使用基类的 addLayer 方法
        existing.addLayer(1);
        break;

      case StackRule.REFRESH_DURATION:
        // Refresh to the new buff's duration, not the existing buff's max duration
        existing.refreshToDuration(newBuff.getMaxDuration());
        break;

      case StackRule.OVERRIDE:
        // 原子替换：停用旧 Buff，激活新 Buff
        existing.onDeactivate();
        this._buffs.set(existing.id, newBuff);
        newBuff.setOwner(this._owner);
        newBuff.onActivate();
        this._owner.updateDerivedStats();
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
      // 使用新的生命周期方法
      clonedBuff.setOwner(owner);
      clonedBuff.onActivate();
    }
    return clone;
  }
}
