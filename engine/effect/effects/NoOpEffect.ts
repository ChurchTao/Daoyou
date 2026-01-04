import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext } from '../types';

/**
 * 空操作效果
 * 用作占位或未实现效果的替代
 */
export class NoOpEffect extends BaseEffect {
  readonly id = 'NoOp';
  readonly trigger = EffectTrigger.ON_STAT_CALC;

  constructor() {
    super({});
  }

  /**
   * 永不触发
   */
  shouldTrigger(_ctx: EffectContext): boolean {
    return false;
  }

  /**
   * 不做任何操作
   */
  apply(_ctx: EffectContext): void {
    // 空操作
  }
}
