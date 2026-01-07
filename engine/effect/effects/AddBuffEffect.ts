import { BuffMaterializer } from '@/engine/buff/BuffMaterializer';
import { buffTemplateRegistry } from '@/engine/buff/BuffTemplateRegistry';
import {
  BuffEventType,
  BuffStackType,
  BuffTag,
  type BuffConfig,
  type BuffMaterializationContext,
  type BuffParamsOverride,
} from '@/engine/buff/types';
import { getEffectDisplayInfo } from '@/lib/utils/effectDisplay';
import type { Quality, RealmType } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type AddBuffParams,
  type EffectContext,
} from '../types';

/**
 * 施加 Buff 效果
 * 支持动态 Buff 系统，可根据施法者属性动态计算 Buff 效果数值
 */
export class AddBuffEffect extends BaseEffect {
  readonly id = 'AddBuff';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** Buff 配置 ID */
  private buffId: string;
  /** 基础命中率 (0-1)，默认 1.0 */
  private chance: number;
  /** 持续回合数覆盖 */
  private durationOverride?: number;
  /** 初始层数 */
  private initialStacks: number;
  /** 目标自身还是敌人 */
  private targetSelf: boolean;
  /** Buff 效果参数覆盖 (动态 Buff 系统) */
  private paramsOverride?: BuffParamsOverride;
  /** 数值化上下文 (动态 Buff 系统) */
  private materializationContext?: BuffMaterializationContext;

  constructor(params: AddBuffParams) {
    super(params as unknown as Record<string, unknown>);

    this.buffId = params.buffId;
    this.chance = params.chance ?? 1.0;
    this.durationOverride = params.durationOverride;
    this.initialStacks = params.initialStacks ?? 1;
    this.targetSelf = params.targetSelf ?? false;
    this.paramsOverride = params.paramsOverride;
    this.materializationContext = params.materializationContext;
  }

  /**
   * 应用 Buff 效果
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source) return;

    // 确定目标
    const buffTarget = this.targetSelf ? ctx.source : ctx.target;
    if (!buffTarget) return;

    // 检查目标是否为 BattleEntity
    if (!isBattleEntity(buffTarget)) {
      console.warn('[AddBuffEffect] target is not a BattleEntity');
      return;
    }

    // 构建数值化上下文
    const context = this.buildMaterializationContext(ctx);

    // 从模板获取并数值化 Buff
    const template = buffTemplateRegistry.get(this.buffId);
    if (!template) {
      console.warn(`[AddBuffEffect] Buff 模板未找到: ${this.buffId}`);
      return;
    }

    // 动态 Buff：从模板数值化
    const buffConfig = BuffMaterializer.materialize(
      template,
      context,
      this.paramsOverride,
    );

    // 1. 基础概率判定
    if (Math.random() > this.chance) {
      ctx.logCollector?.addLog(
        `${buffTarget.name} 神识强大，抵抗了「${buffConfig.name}」效果！`,
      );
      return;
    }

    // 2. 控制效果抵抗判定（非自身目标时）
    const isControlBuff = buffConfig?.tags?.includes(BuffTag.CONTROL);
    if (isControlBuff && !this.targetSelf && ctx.target) {
      const resisted = this.checkResistance(ctx);
      if (resisted) {
        ctx.logCollector?.addLog(
          `${buffTarget.name} 神识强大，抵抗了「${buffConfig.name}」效果！`,
        );
        return;
      }
    }

    // 3. 成功施加，直接调用 addBuff
    const event = buffTarget.addBuff(buffConfig, ctx.source, 0, {
      durationOverride: this.durationOverride,
      initialStacks: this.initialStacks,
    });

    if (event.type === BuffEventType.APPLIED) {
      // 记录日志
      const duration = this.durationOverride ?? buffConfig.duration;
      const durationText = duration > 0 ? `（${duration}回合）` : '';
      const desc = buffConfig.description ? `，${buffConfig.description}` : '';
      ctx.logCollector?.addLog(
        `${buffTarget.name} 获得「${buffConfig.name}」状态${durationText}${desc}`,
      );
    }
  }

  /**
   * 构建 Buff 数值化上下文
   * 从施法者和上下文中提取需要的信息
   */
  private buildMaterializationContext(
    ctx: EffectContext,
  ): BuffMaterializationContext {
    // 如果已经提供了上下文，直接使用
    if (this.materializationContext) {
      return this.materializationContext;
    }

    // 从施法者构建上下文
    return {
      casterSpirit: ctx.source?.getAttribute('spirit'),
      casterWisdom: ctx.source?.getAttribute('wisdom'),
      casterWillpower: ctx.source?.getAttribute('willpower'),
      casterVitality: ctx.source?.getAttribute('vitality'),
      casterRealm: (ctx.metadata?.casterRealm as RealmType) ?? '炖气',
      // 【修复】默认使用玄品（倍率 1.0）而不是凡品（倍率 0.5）
      quality: (ctx.metadata?.quality as Quality) ?? '玄品',
      stacks: this.initialStacks,
    };
  }

  /**
   * 检查控制效果抵抗
   * 基于施法者灵力和目标神识的差值计算
   */
  private checkResistance(ctx: EffectContext): boolean {
    const casterSpirit = ctx.source?.getAttribute('spirit') ?? 0;
    const targetWillpower = ctx.target?.getAttribute('willpower') ?? 0;

    // 基础命中率 = 效果配置的 chance（已在上面判定）
    // 抵抗率 = 神识优势
    // 神识每高于施法者灵力 10 点，增加 5% 抵抗率
    // 最高抵抗率 40%
    const willpowerAdvantage = targetWillpower - casterSpirit;
    const resistRate = Math.min(
      0.4,
      Math.max(0, (willpowerAdvantage / 10) * 0.05),
    );

    return Math.random() < resistRate;
  }

  /**
   * 获取 Buff 配置用于显示
   */
  private getDisplayConfig(): BuffConfig | undefined {
    return buffTemplateRegistry.getDefaultConfig(this.buffId);
  }

  displayInfo() {
    const buffConfig = this.getDisplayConfig();
    /** 最大叠加层数 */
    const stackText =
      buffConfig?.stackType == BuffStackType.STACK
        ? `，初始叠加层数 ${this.initialStacks}层，最大叠加层数 ${buffConfig.maxStacks}层`
        : '';
    /** 叠加策略 */
    const stackTypeText =
      buffConfig?.stackType == BuffStackType.STACK
        ? '可叠加' + stackText
        : buffConfig?.stackType == BuffStackType.REFRESH
          ? '不可叠加'
          : '每次施加为独立状态';
    /** 默认持续回合数 */
    const durationText = `，持续${this.durationOverride ?? buffConfig?.duration}回合`;

    /** Buff 携带的效果列表 */
    const effectText = buffConfig?.effects?.length
      ? `，效果为：${buffConfig.effects
          .map((e) => getEffectDisplayInfo(e)?.description ?? '')
          .filter(Boolean)
          .join('、')}`
      : '';

    return {
      label: '附加状态',
      icon: buffConfig?.icon,
      description: `${!this.targetSelf ? '技能命中目标时，' : '为自身'}施加${buffConfig?.name}状态，${stackTypeText}${durationText}${effectText}`,
    };
  }
}
