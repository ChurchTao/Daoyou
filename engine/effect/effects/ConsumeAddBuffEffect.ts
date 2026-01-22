import { buffTemplateRegistry } from '@/engine/buff/BuffTemplateRegistry';
import type { BuffInstanceState } from '@/engine/buff/types';
import type { TalismanBuffMetadata } from '@/types/cultivator';
import { randomUUID } from 'node:crypto';
import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext } from '../types';

/**
 * 消耗品添加持久 Buff 参数
 */
export interface ConsumeAddBuffParams {
  /** Buff 配置 ID */
  buffId: string;
  /** 过期时间（分钟） */
  expiryMinutes?: number;
  /** 最大使用次数 */
  maxUses?: number;
  /** 初始层数 */
  initialStacks?: number;
  /** 符箓类型（可选，用于元数据） */
  drawType?: 'gongfa' | 'skill';
}

/**
 * 消耗品添加持久 Buff 效果
 * 用于消耗品触发的持久 Buff 添加（如符箓）
 * 与 AddBuff 的区别：
 * - 添加到 persistent_statuses 而非战斗 Buff
 * - 支持过期时间（expiresAt，单位：分钟）和使用次数（usesRemaining）
 */
export class ConsumeAddBuffEffect extends BaseEffect {
  readonly id = 'ConsumeAddBuff';
  readonly trigger = EffectTrigger.ON_CONSUME;

  /** Buff 配置 ID */
  private buffId: string;
  /** 过期时间（分钟） */
  private expiryMinutes?: number;
  /** 最大使用次数 */
  private maxUses?: number;
  /** 初始层数 */
  private initialStacks: number;
  /** 符箓类型（可选） */
  private drawType?: 'gongfa' | 'skill';

  constructor(params: ConsumeAddBuffParams) {
    super(params as unknown as Record<string, unknown>);

    this.buffId = params.buffId;
    this.expiryMinutes = params.expiryMinutes;
    this.maxUses = params.maxUses;
    this.initialStacks = params.initialStacks ?? 1;
    this.drawType = params.drawType;
  }

  /**
   * 只在 ON_CONSUME 触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_CONSUME;
  }

  /**
   * 应用持久 Buff
   */
  apply(ctx: EffectContext): void {
    const target = ctx.target;
    if (!target) return;

    // 获取 Buff 配置
    const template = buffTemplateRegistry.get(this.buffId);
    if (!template) {
      throw new Error(`[ConsumeAddBuffEffect] Buff 模板未找到: ${this.buffId}`);
    }

    // 检查是否已存在同类 Buff（通过 target 的 persistent_statuses）
    // 注意：这里需要从外部传入 persistent_statuses，或通过 metadata 获取
    const existingStatuses =
      (ctx.metadata?.persistent_statuses as BuffInstanceState[]) || [];
    const hasExisting = existingStatuses.some(
      (s) => s.configId === this.buffId,
    );

    if (hasExisting) {
      throw new Error(`已激活同类符箓效果`);
    }

    // 创建持久 Buff 实例
    const buffInstance: BuffInstanceState = {
      instanceId: randomUUID(),
      configId: this.buffId,
      currentStacks: this.initialStacks,
      remainingTurns: -1, // 持久 Buff 使用 -1 表示非战斗状态
      createdAt: Date.now(),
      metadata: {
        expiresAt: this.expiryMinutes
          ? Date.now() + this.expiryMinutes * 60 * 1000
          : undefined,
        usesRemaining: this.maxUses,
        drawType: this.drawType,
      } as TalismanBuffMetadata,
    };

    // 通过 metadata 返回新创建的 Buff 实例，由外部处理持久化
    if (!ctx.metadata?.newBuffs) {
      ctx.metadata!.newBuffs = [];
    }
    (ctx.metadata!.newBuffs as BuffInstanceState[]).push(buffInstance);

    ctx.logCollector?.addLog(`${target.name} 获得「${template.name}」状态`);
  }

  displayInfo() {
    const buffConfig = buffTemplateRegistry.getDefaultConfig(this.buffId);

    const expiryText = this.expiryMinutes
      ? `，持续 ${this.expiryMinutes} 分钟`
      : '';
    const usesText = this.maxUses ? `，使用 ${this.maxUses} 次` : '';

    return {
      label: '添加持久状态',
      icon: buffConfig?.icon,
      description: `使用后获得「${buffConfig?.name || this.buffId}」状态${expiryText}${usesText}`,
    };
  }
}
