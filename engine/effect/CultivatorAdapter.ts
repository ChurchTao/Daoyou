import type { Cultivator } from '@/types/cultivator';
import type { Entity, IBaseEffect } from './types';

/**
 * Cultivator 适配器
 * 将纯数据对象 Cultivator 适配为 EffectEngine 需要的 Entity 接口
 */
export class CultivatorAdapter implements Entity {
  private cultivator: Cultivator;
  private effects: IBaseEffect[] = [];

  constructor(cultivator: Cultivator, effects: IBaseEffect[] = []) {
    this.cultivator = cultivator;
    this.effects = effects;
  }

  get id(): string {
    return this.cultivator.id || '';
  }

  get name(): string {
    return this.cultivator.name;
  }

  getAttribute(key: string): number {
    // 支持基础属性
    if (key in this.cultivator.attributes) {
      return this.cultivator.attributes[key as keyof typeof this.cultivator.attributes] || 0;
    }
    // 支持其他属性（如 maxHp, maxMp 等）
    return 0;
  }

  setAttribute(key: string, value: number): void {
    // 只支持修改基础属性
    if (key in this.cultivator.attributes) {
      this.cultivator.attributes[key as keyof typeof this.cultivator.attributes] = value;
    }
  }

  collectAllEffects(): IBaseEffect[] {
    return this.effects;
  }

  /**
   * 获取底层数据对象
   */
  getData(): Cultivator {
    return this.cultivator;
  }

  /**
   * 更新持久状态
   */
  updatePersistentStatuses(statuses: unknown): void {
    this.cultivator.persistent_statuses = statuses;
  }
}
