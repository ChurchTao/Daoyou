import type { BaseEffect } from './BaseEffect';
import type {
  EffectContext,
  EffectTrigger,
  Entity,
  IBaseEffect,
} from './types';
import { EffectLogCollector } from './types';

/**
 * 效果引擎执行结果
 */
export interface EffectEngineResult {
  /** 效果上下文 */
  ctx: EffectContext;
  /** 日志消息数组 */
  logs: string[];
}

/**
 * 效果引擎
 * 统一处理所有效果的执行
 */
class EffectEngine {
  /**
   * 处理效果
   * @param trigger 触发时机
   * @param source 来源实体
   * @param target 目标实体（可选）
   * @param initialValue 初始值
   * @param metadata 额外数据
   * @returns 处理后的值
   */
  process(
    trigger: EffectTrigger,
    source: Entity,
    target: Entity | undefined,
    initialValue: number,
    metadata: Record<string, unknown> = {},
  ): number {
    // 1. 构建效果上下文
    const ctx: EffectContext = {
      source,
      target,
      trigger,
      value: initialValue,
      metadata,
    };

    // 2. 收集所有相关效果
    const effects = this.collectEffects(source, target);

    // 3. 筛选与当前触发时机匹配的效果
    const activeEffects = effects
      .filter((e) => e.trigger === trigger && e.shouldTrigger(ctx))
      .sort((a, b) => a.priority - b.priority);

    // 4. 依次执行效果
    for (const effect of activeEffects) {
      effect.apply(ctx);
    }

    return ctx.value ?? initialValue;
  }

  /**
   * 处理效果并返回完整上下文和日志
   * 用于需要访问 metadata 和日志的场景
   * @returns 包含上下文和日志消息的结果
   */
  processWithContext(
    trigger: EffectTrigger,
    source: Entity,
    target: Entity | undefined,
    initialValue: number,
    metadata: Record<string, unknown> = {},
    extraEffects?: BaseEffect[],
  ): EffectEngineResult {
    // 1. 创建日志收集器
    const logCollector = new EffectLogCollector();

    // 2. 构建效果上下文
    const ctx: EffectContext = {
      source,
      target,
      trigger,
      value: initialValue,
      metadata,
      logCollector,
    };

    // 3. 收集所有相关效果
    const effects = this.collectEffects(source, target);

    // 4. 筛选与当前触发时机匹配的效果
    const activeEffects = effects
      .concat(extraEffects || [])
      .filter(Boolean)
      .filter((e) => e.trigger === trigger && e.shouldTrigger(ctx))
      .sort((a, b) => a.priority - b.priority);

    // 5. 依次执行效果
    for (const effect of activeEffects) {
      effect.apply(ctx);
    }

    // 6. 返回上下文和日志
    return {
      ctx,
      logs: logCollector.getLogMessages(),
    };
  }

  /**
   * 收集所有相关效果
   * 从来源和目标实体身上收集
   */
  private collectEffects(source: Entity, target?: Entity): BaseEffect[] {
    const effects: IBaseEffect[] = [];

    // 1. 收集来源实体的效果（装备、被动、Buff 等）
    if (source.collectAllEffects) {
      effects.push(...source.collectAllEffects());
    }

    // 2. 收集目标实体的效果（防御型 Buff、抗性等）
    // 【关键修复】当 source === target 时，不重复收集，避免效果被执行两次
    if (target && target !== source && target.collectAllEffects) {
      effects.push(...target.collectAllEffects());
    }

    return effects as BaseEffect[];
  }
}

// 导出单例
export const effectEngine = new EffectEngine();
