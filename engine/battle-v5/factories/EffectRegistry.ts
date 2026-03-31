import { checkConditions } from '../core/conditionEvaluator';
import { ConditionConfig, EffectConfig } from '../core/configs';
import { EffectContext, GameplayEffect } from '../effects/Effect';

/**
 * 效果构造器类型定义
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EffectConstructor = (params: any) => GameplayEffect;

/**
 * 效果注册表
 * 职责：解耦工厂与具体实现类，提供全局统一的 GE 实例化入口
 */
export class EffectRegistry {
  private static instance: EffectRegistry;
  private registry: Map<string, EffectConstructor> = new Map();

  private constructor() {}

  static getInstance(): EffectRegistry {
    if (!EffectRegistry.instance) {
      EffectRegistry.instance = new EffectRegistry();
    }
    return EffectRegistry.instance;
  }

  /**
   * 注册一个新的效果构造器
   */
  register(type: string, constructor: EffectConstructor): void {
    this.registry.set(type, constructor);
  }

  /**
   * 创建效果实例，并注入条件检查包装
   */
  create(config: EffectConfig): GameplayEffect | null {
    const constructor = this.registry.get(config.type);
    if (!constructor) {
      console.warn(`EffectRegistry: 未找到类型为 ${config.type} 的效果注册`);
      return null;
    }

    const baseEffect = constructor(config.params);

    // 如果有执行条件，则返回一个带包装的效果
    if (config.conditions && config.conditions.length > 0) {
      return this.wrapWithConditions(baseEffect, config.conditions);
    }

    return baseEffect;
  }

  /**
   * 使用条件检查包装原始效果 (代理模式)
   */
  private wrapWithConditions(
    effect: GameplayEffect,
    conditions: ConditionConfig[],
  ): GameplayEffect {
    return {
      execute: (context: EffectContext) => {
        if (this.checkConditions(context, conditions)) {
          effect.execute(context);
        }
      },
    } as GameplayEffect;
  }

  /**
   * 检查所有条件是否满足
   */
  private checkConditions(
    context: EffectContext,
    conditions: ConditionConfig[],
  ): boolean {
    return checkConditions(context, conditions);
  }
}
