import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type ExecuteDamageParams,
} from '../types';

/**
 * 斩杀伤害效果
 * 对低生命目标造成额外伤害
 *
 * 使用场景：
 * - 武器词条："破军斩将" - 对低生命敌人额外伤害
 * - 攻击技能："诛仙剑气" - 斩杀低血量目标
 */
export class ExecuteDamageEffect extends BaseEffect {
  readonly id = 'ExecuteDamage';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;

  /** 生命阈值百分比 */
  private thresholdPercent: number;
  /** 额外伤害倍率 */
  private bonusDamage: number;
  /** 是否对护盾有效 */
  private affectShield: boolean;

  constructor(params: ExecuteDamageParams) {
    super(params as unknown as Record<string, unknown>);
    this.thresholdPercent = params.thresholdPercent ?? 0.3;
    this.bonusDamage = params.bonusDamage ?? 0.2;
    this.affectShield = params.affectShield ?? false;
  }

  /**
   * 检查是否触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEFORE_DAMAGE) return false;

    // 攻击者是持有者
    if (this.ownerId && ctx.source?.id !== this.ownerId) return false;

    // 检查目标生命是否低于阈值
    if (!ctx.target) return false;

    const currentHp = ctx.target.getAttribute('hp') ?? 0;
    const maxHp = ctx.target.getAttribute('maxHp') ?? 1;
    const hpPercent = currentHp / maxHp;

    return hpPercent <= this.thresholdPercent;
  }

  /**
   * 应用效果
   * 增加额外伤害
   */
  apply(ctx: EffectContext): void {
    const baseDamage = ctx.value ?? 0;
    if (baseDamage <= 0) return;
    if (!ctx.target) return;

    // 计算目标缺少的生命百分比（越低伤害越高）
    const currentHp = ctx.target.getAttribute('hp') ?? 0;
    const maxHp = ctx.target.getAttribute('maxHp') ?? 1;
    const missingHpPercent = 1 - currentHp / maxHp;

    // 斩杀加成 = 基础加成 * (1 + 缺失生命百分比)
    // 例如：目标 20% 血量，缺失 80%，加成 = 0.2 * 1.8 = 36%
    const executeMutiplier = this.bonusDamage * (1 + missingHpPercent);
    const bonusDamage = baseDamage * executeMutiplier;

    ctx.value = baseDamage + bonusDamage;

    // 记录日志
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.executeDamage = bonusDamage;
    ctx.metadata.executeTriggered = true;

    // 添加日志反馈
    ctx.logCollector?.addLog(
      `${ctx.target.name} 生命危急，斩杀效果触发，额外造成 ${Math.floor(bonusDamage)} 点伤害！`,
    );
  }

  displayInfo() {
    const thresholdPercent = Math.round(this.thresholdPercent * 100);
    const bonusPercent = Math.round(this.bonusDamage * 100);

    return {
      label: '斩杀',
      icon: '💀',
      description: `对生命低于 ${thresholdPercent}% 的目标造成额外 ${bonusPercent}%+ 伤害（生命越低伤害越高）`,
    };
  }
}
