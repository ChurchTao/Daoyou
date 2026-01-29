import type { Quality, RealmType } from '@/types/constants';
import { QUALITY_ORDER, REALM_ORDER } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import {
  type ConsumeGainComprehensionParams,
  EffectTrigger,
  type EffectContext,
} from '../types';

/**
 * 消耗品获得感悟效果
 * 服用丹药后获得道心感悟，数值随境界/品质缩放
 */
export class ConsumeGainComprehensionEffect extends BaseEffect {
  readonly id = 'ConsumeGainComprehension';
  readonly trigger = EffectTrigger.ON_CONSUME;

  /** 基础感悟值 */
  private base: number;
  /** 缩放依据 */
  private scale: 'quality' | 'realm';
  /** 缩放系数 */
  private coefficient: number;

  constructor(params: ConsumeGainComprehensionParams) {
    super(params as unknown as Record<string, unknown>);

    this.base = params.base;
    this.scale = params.scale ?? 'quality';
    this.coefficient = params.coefficient ?? 3;
  }

  /**
   * 只在 ON_CONSUME 触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_CONSUME;
  }

  /**
   * 计算缩放加成
   */
  private calculateBonus(ctx: EffectContext): number {
    if (this.scale === 'quality') {
      const quality = ctx.metadata?.quality as Quality | undefined;
      if (!quality) return 0;
      const qualityLevel = QUALITY_ORDER[quality] ?? 0;
      return qualityLevel * this.coefficient;
    } else {
      // scale === 'realm'
      const realm = ctx.metadata?.realm as RealmType | undefined;
      if (!realm) return 0;
      const realmLevel = REALM_ORDER[realm] ?? 0;
      return realmLevel * this.coefficient;
    }
  }

  /**
   * 应用感悟增益
   */
  apply(ctx: EffectContext): void {
    const target = ctx.target;
    if (!target) return;

    // 计算最终感悟值
    const bonus = this.calculateBonus(ctx);
    const finalValue = this.base + bonus;

    // 将值存储到 metadata 中供外部使用
    if (!ctx.metadata) {
      ctx.metadata = {};
    }
    (ctx.metadata as Record<string, unknown>).pendingComprehension = finalValue;

    // 记录日志
    ctx.logCollector?.addLog(
      `${target.name} 获得 ${finalValue} 点道心感悟` +
        (bonus > 0 ? `（基础 ${this.base} + 加成 ${bonus}）` : ''),
    );
  }

  displayInfo() {
    return {
      label: '获得感悟',
      icon: '💡',
      description: `使用后获得 ${this.base} 点道心感悟` +
        (this.scale === 'quality'
          ? '，数值随品质提升'
          : '，数值随境界提升'),
    };
  }
}
