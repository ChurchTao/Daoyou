import { BuffId, BuffType } from '../core/types';
import { Unit } from '../units/Unit';
import { GameplayTagContainer } from '../core/GameplayTags';

// 堆叠规则枚举
export const StackRule = {
  STACK_LAYER: 'stack_layer',
  REFRESH_DURATION: 'refresh_duration',
  OVERRIDE: 'override',
  IGNORE: 'ignore',
} as const;

// 堆叠规则类型
export type StackRule = typeof StackRule[keyof typeof StackRule];

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

  // 新增：标签和堆叠规则
  tags: GameplayTagContainer;
  readonly stackRule: StackRule;

  // 生命周期钩子（可被子类重写）
  onApply: (unit: Unit) => void = () => {};
  onRemove: (unit: Unit) => void = () => {};
  onTurnStart: (unit: Unit) => void = () => {};
  onTurnEnd: (unit: Unit) => void = () => {};
  onBeforeAct: (unit: Unit) => void = () => {};
  onAfterAct: (unit: Unit) => void = () => {};
  onBattleStart: (unit: Unit) => void = () => {};
  onBattleEnd: (unit: Unit) => void = () => {};

  constructor(
    id: BuffId,
    name: string,
    type: BuffType,
    duration: number,
    stackRule: StackRule = StackRule.REFRESH_DURATION
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this._maxDuration = duration;
    this._duration = duration;
    this.stackRule = stackRule;

    // 初始化标签容器
    this.tags = new GameplayTagContainer();
  }

  /**
   * 持续时间管理
   */
  getDuration(): number {
    return this._duration;
  }

  getMaxDuration(): number {
    return this._maxDuration;
  }

  tickDuration(): void {
    if (!this.isPermanent()) {
      this._duration = Math.max(0, this._duration - 1);
    }
  }

  refreshDuration(): void {
    this._duration = this._maxDuration;
  }

  /**
   * 设置持续时间（供子类 clone 使用）
   */
  protected setDuration(duration: number): void {
    this._duration = duration;
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

  /**
   * 克隆 Buff 实例
   * 子类可以重写此方法以实现更复杂的克隆逻辑
   * 注意：生命周期钩子不会被复制，需要重新绑定
   */
  clone(): Buff {
    const cloned = new Buff(
      this.id,
      this.name,
      this.type,
      this._maxDuration,
      this.stackRule
    );
    cloned.setDuration(this._duration);
    cloned.tags = this.tags.clone();
    // 生命周期钩子由子类在激活时重新设置
    return cloned;
  }
}
