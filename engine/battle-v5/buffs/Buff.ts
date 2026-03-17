import { BuffId, BuffType } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * BUFF 基类
 * 支持完整生命周期和持续时间管理
 */
export class Buff {
  readonly id: BuffId;
  readonly name: string;
  readonly type: BuffType;
  private _duration: number;
  private _maxDuration: number;

  // 生命周期钩子（可被子类重写）
  onApply: (unit: Unit) => void = () => {};
  onRemove: (unit: Unit) => void = () => {};
  onTurnStart: (unit: Unit) => void = () => {};
  onTurnEnd: (unit: Unit) => void = () => {};
  onBeforeAct: (unit: Unit) => void = () => {};
  onAfterAct: (unit: Unit) => void = () => {};
  onBattleStart: (unit: Unit) => void = () => {};
  onBattleEnd: (unit: Unit) => void = () => {};

  constructor(id: BuffId, name: string, type: BuffType, duration: number) {
    this.id = id;
    this.name = name;
    this.type = type;
    this._maxDuration = duration;
    this._duration = duration;
  }

  /**
   * 持续时间管理
   */
  getDuration(): number {
    return this._duration;
  }

  tickDuration(): void {
    if (!this.isPermanent()) {
      this._duration = Math.max(0, this._duration - 1);
    }
  }

  refreshDuration(): void {
    this._duration = this._maxDuration;
  }

  isPermanent(): boolean {
    return this._maxDuration === -1;
  }

  isExpired(): boolean {
    return !this.isPermanent() && this._duration <= 0;
  }

  /**
   * 属性修改器（可被子类重写）
   */
  getAttributeModifiers(): [] {
    return [];
  }
}
