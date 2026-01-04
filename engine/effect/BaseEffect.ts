import type { EffectContext, EffectTrigger } from './types';

/**
 * 效果抽象基类
 * 所有具体效果都需要继承此类
 */
export abstract class BaseEffect {
  /** 效果唯一标识 */
  abstract readonly id: string;

  /** 触发时机 */
  abstract readonly trigger: EffectTrigger;

  /**
   * 优先级 (数字越小越先执行)
   * 默认为 0，子类可覆盖
   */
  priority: number = 0;

  /**
   * 效果配置
   * 可存储任意配置参数
   */
  protected config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  /**
   * 检查是否满足触发条件
   * 默认返回 true，子类可覆盖进行条件判断
   * @param ctx 效果上下文
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return true;
  }

  /**
   * 执行效果
   * 必须由子类实现
   * @param ctx 效果上下文
   */
  abstract apply(ctx: EffectContext): void;
}
