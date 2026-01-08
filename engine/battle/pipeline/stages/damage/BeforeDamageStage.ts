import { effectEngine } from '@/engine/effect';
import { EffectTrigger } from '@/engine/effect/types';
import {
  StagePriority,
  type DamagePipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 伤害前处理阶段
 * 调用 EffectEngine 处理 ON_BEFORE_DAMAGE 触发的所有效果：
 * - CriticalEffect: 暴击判定
 * - DamageReductionEffect: 减伤计算
 * - ShieldEffect: 护盾吸收
 * - ExecuteDamageEffect: 斩杀伤害
 */
export class BeforeDamageStage implements PipelineStage<DamagePipelineContext> {
  readonly name = 'BeforeDamageStage';
  readonly priority = StagePriority.BEFORE_DAMAGE;

  process(ctx: DamagePipelineContext): void {
    const { caster, target, skill, damage } = ctx;

    if (damage <= 0) {
      ctx.shouldContinue = false;
      return;
    }

    // 调用 EffectEngine 处理所有 ON_BEFORE_DAMAGE 效果
    const result = effectEngine.processWithContext(
      EffectTrigger.ON_BEFORE_DAMAGE,
      caster,
      target,
      damage,
      {
        skillName: skill.name,
        skillElement: skill.element,
        element: ctx.element,
        canCrit: ctx.canCrit,
        ignoreDefense: ctx.ignoreDefense,
        ignoreShield: ctx.ignoreShield,
        critRateBonus: ctx.critRateBonus,
        critDamageBonus: ctx.critDamageBonus,
      },
    );

    // 读取处理后的结果
    ctx.damage = Math.max(0, Math.floor(result.ctx.value ?? 0));
    ctx.isCritical = result.ctx.metadata?.isCritical === true;
    ctx.shieldAbsorbed = (result.ctx.metadata?.shieldAbsorbed as number) ?? 0;

    // 合并日志
    ctx.logs.push(...result.logs);
  }
}
