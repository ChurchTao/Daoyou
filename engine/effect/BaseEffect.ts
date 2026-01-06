import { EffectDisplayInfo } from '@/lib/utils/effectDisplay';
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
   * 效果持有者 ID
   * 用于判断效果应该作用于谁（如护盾只对持有者生效）
   */
  ownerId?: string;

  /**
   * 关联的父 Buff ID
   * 用于在效果需要移除整个 buff 时使用（如护盾耗尽）
   * 命名为 parentBuffId 以避免与子类（如 AddBuffEffect）的 buffId 冲突
   */
  parentBuffId?: string;

  /**
   * 效果配置
   * 可存储任意配置参数
   */
  protected config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  /**
   * 设置效果持有者
   * @param ownerId 持有者实体 ID
   */
  setOwner(ownerId: string): this {
    this.ownerId = ownerId;
    return this;
  }

  /**
   * 设置关联的父 Buff ID
   * @param buffId Buff 配置 ID
   */
  setParentBuff(buffId: string): this {
    this.parentBuffId = buffId;
    return this;
  }

  /**
   * 检查是否满足触发条件
   * 默认返回子类的 trigger，子类可覆盖进行条件判断
   * @param ctx 效果上下文
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === this.trigger;
  }

  /**
   * 执行效果
   * 必须由子类实现
   * @param ctx 效果上下文
   */
  abstract apply(ctx: EffectContext): void;

  /**
   * 前端显示渲染
   */
  abstract displayInfo(): EffectDisplayInfo;
}
